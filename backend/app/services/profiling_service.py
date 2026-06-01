from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.company import Company
from app.models.profiling import ProfilingQuestion, CompanyProfileAnswer
from app.models.data_element import DataElement
from app.models.checklist import CompanyChecklist
from app.models.meter import Meter

# Mapping from shorthand Excel codes (E, D, G) to normalized active frameworks (esg, dst, green key)
FW_MAPPING = {
    "e": "esg",
    "d": "dst",
    "g": "green key"
}

class ProfilingService:
    @staticmethod
    async def generate_checklist(
        company_id: int,
        site_id: Optional[int],
        answers: List[Dict[str, Any]], # List of dicts: {"question_id": 1, "answer": True}
        db: AsyncSession,
    ) -> None:
        """
        Receives profiling answers for a specific (company_id, site_id) pair,
        saves them, and generates the site-scoped checklist and main meters.
        """
        company = await db.get(Company, company_id)
        if not company:
            raise ValueError("Company not found")

        # 1. Save Answers — scoped to (company_id, site_id)
        ans_stmt = select(CompanyProfileAnswer).where(
            CompanyProfileAnswer.company_id == company_id,
            CompanyProfileAnswer.site_id == site_id,
        )
        existing_answers = {a.question_id: a for a in (await db.execute(ans_stmt)).scalars().all()}

        for ans in answers:
            existing = existing_answers.get(ans['question_id'])
            if existing:
                existing.answer = ans['answer']
            else:
                db.add(CompanyProfileAnswer(
                    company_id=company_id,
                    site_id=site_id,
                    question_id=ans['question_id'],
                    answer=ans['answer'],
                ))

        await db.commit()

        # 2. Compute active frameworks
        active_frameworks = set()
        if company.active_frameworks:
            for fw in company.active_frameworks:
                active_frameworks.add(fw.strip().lower())

        # Always ensure ESG is active
        active_frameworks.add("esg")

        if getattr(company, 'has_green_key', False) and company.sector.lower() == "hospitality":
            active_frameworks.add("green key")

        # Resolve emirate and sector for this site to decide DST
        resolved_emirate = company.emirate
        resolved_sector = company.sector
        if site_id is not None:
            from app.models.company import Site
            site = await db.get(Site, site_id)
            if site:
                if site.location:
                    resolved_emirate = site.location
                if site.sector:
                    resolved_sector = site.sector

        if resolved_emirate and resolved_sector:
            if "dubai" in resolved_emirate.lower() and "hospitality" in resolved_sector.lower():
                active_frameworks.add("dst")
            else:
                active_frameworks.discard("dst")

        # 3. Active conditions from TRUE answers — scoped to this site
        stmt_true_qs = select(ProfilingQuestion.question_text).join(CompanyProfileAnswer).where(
            CompanyProfileAnswer.company_id == company_id,
            CompanyProfileAnswer.site_id == site_id,
            CompanyProfileAnswer.answer == True,
        )
        active_conditions = set((await db.execute(stmt_true_qs)).scalars().all())

        stmt = select(DataElement).where(DataElement.category.in_(["E", "S", "G"]))
        all_elements = (await db.execute(stmt)).scalars().all()

        # Scoped checklist + main-meter lookup
        cl_stmt = select(CompanyChecklist).where(
            CompanyChecklist.company_id == company_id,
            CompanyChecklist.site_id == site_id,
        )
        existing_checklists = {c.data_element_id: c for c in (await db.execute(cl_stmt)).scalars().all()}

        mtr_stmt = select(Meter).where(
            Meter.company_id == company_id,
            Meter.site_id == site_id,
        )
        existing_meters = {m.data_element_id: m for m in (await db.execute(mtr_stmt)).scalars().all() if m.name.startswith("Main ")}

        requires_meter_setup = []

        for element in all_elements:
            # Framework match
            framework_match = False
            if element.frameworks:
                element_fws = [f.strip().lower() for f in element.frameworks.split(',') if f.strip()]
                mapped_fws = [FW_MAPPING.get(fw, fw) for fw in element_fws]
                if any(fw in active_frameworks for fw in mapped_fws):
                    framework_match = True
            else:
                framework_match = True

            # Condition match
            if not element.condition_logic:
                condition_match = True
            else:
                condition_match = element.condition_logic in active_conditions

            target_element = framework_match and condition_match
            existing_checklist = existing_checklists.get(element.id)

            if target_element:
                if not existing_checklist:
                    db.add(CompanyChecklist(
                        company_id=company_id,
                        site_id=site_id,
                        data_element_id=element.id,
                        framework_id=None,
                        frequency=element.collection_frequency,
                    ))
                    if element.is_metered:
                        requires_meter_setup.append(element)
            else:
                if existing_checklist:
                    await db.delete(existing_checklist)
                if element.is_metered:
                    meter_to_delete = existing_meters.get(element.id)
                    if meter_to_delete:
                        await db.delete(meter_to_delete)

        await db.commit()

        # 4. Auto-create "Main" meters for this site
        for element in requires_meter_setup:
            if existing_meters.get(element.id):
                continue
            db.add(Meter(
                company_id=company_id,
                site_id=site_id,
                data_element_id=element.id,
                name=f"Main {element.name} Meter",
                meter_type=element.meter_type or element.category,
            ))

        await db.commit()
