from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.company import Company
from app.models.profiling import ProfilingQuestion, CompanyProfileAnswer
from app.models.data_element import DataElement
from app.models.checklist import CompanyChecklist
from app.models.meter import Meter

class ProfilingService:
    @staticmethod
    async def generate_checklist(
        company_id: int, 
        answers: List[Dict[str, Any]], # List of dicts: {"question_id": 1, "answer": True}
        db: AsyncSession
    ) -> None:
        """
        Receives profiling answers, saves them, and generates the company checklist and main meters.
        """
        company = await db.get(Company, company_id)
        if not company:
            raise ValueError("Company not found")

        # 1. Save Answers
        saved_answers = []
        for ans in answers:
            # Check if answer exists to update, else create
            stmt = select(CompanyProfileAnswer).where(
                CompanyProfileAnswer.company_id == company_id,
                CompanyProfileAnswer.question_id == ans['question_id']
            )
            existing = (await db.execute(stmt)).scalars().first()
            if existing:
                 existing.answer = ans['answer']
                 saved_answers.append(existing)
            else:
                 new_ans = CompanyProfileAnswer(
                     company_id=company_id,
                     question_id=ans['question_id'],
                     answer=ans['answer']
                 )
                 db.add(new_ans)
                 saved_answers.append(new_ans)
        
        await db.commit()

        # 2. Logic to Generate Checklist & Meters Based on Frameworks and Answers
        # Get active company frameworks
        active_frameworks = []
        if company.active_frameworks:
            active_frameworks = [f.strip().lower() for f in company.active_frameworks]
            
        if getattr(company, 'has_green_key', False):
            active_frameworks.append('green key')
            
        # Get active conditions based on TRUE answers
        stmt_true_qs = select(ProfilingQuestion.question_text).join(CompanyProfileAnswer).where(
            CompanyProfileAnswer.company_id == company_id,
            CompanyProfileAnswer.answer == True
        )
        active_conditions = set((await db.execute(stmt_true_qs)).scalars().all())

        stmt = select(DataElement).where(DataElement.category.in_(["E", "S", "G"]))
        all_elements = (await db.execute(stmt)).scalars().all()

        requires_meter_setup = []

        for element in all_elements:
            # Check framework match
            framework_match = False
            if element.frameworks:
                element_fws = [f.strip().lower() for f in element.frameworks.split(',') if f.strip()]
                
                # If element explicitly defines frameworks, it must match at least one of company's active frameworks
                if any(fw in active_frameworks for fw in element_fws):
                    framework_match = True
            else:
                framework_match = True # Core element, no specific framework required
                
            # Check condition match
            condition_match = False
            if not element.condition_logic:
                condition_match = True
            else:
                if element.condition_logic in active_conditions:
                    condition_match = True

            # Must satisfy both
            target_element = framework_match and condition_match

            check_stmt = select(CompanyChecklist).where(
                 CompanyChecklist.company_id == company_id,
                 CompanyChecklist.data_element_id == element.id
            )
            existing_checklist = (await db.execute(check_stmt)).scalars().first()

            if target_element:
                if not existing_checklist:
                     checklist_item = CompanyChecklist(
                         company_id=company_id,
                         data_element_id=element.id,
                         framework_id=None,
                         frequency=element.collection_frequency
                     )
                     db.add(checklist_item)
                     
                     if element.is_metered:
                         requires_meter_setup.append(element)
            else:
                if existing_checklist:
                    await db.delete(existing_checklist)
                
                if element.is_metered:
                    meter_del_stmt = select(Meter).where(
                        Meter.company_id == company_id,
                        Meter.data_element_id == element.id,
                        Meter.name == f"Main {element.name} Meter"
                    )
                    meter_to_delete = (await db.execute(meter_del_stmt)).scalars().first()
                    if meter_to_delete:
                        await db.delete(meter_to_delete)
                     
        await db.commit()

        # 3. Auto-Create "Main" Meters
        for element in requires_meter_setup:
            meter_stmt = select(Meter).where(
                Meter.company_id == company_id,
                Meter.data_element_id == element.id,
                Meter.name == f"Main {element.name} Meter"
            )
            meter_exists = (await db.execute(meter_stmt)).scalars().first()
            if not meter_exists:
                 new_meter = Meter(
                     company_id=company_id,
                     data_element_id=element.id,
                     name=f"Main {element.name} Meter",
                     meter_type=element.meter_type or element.category
                 )
                 db.add(new_meter)
        
        await db.commit()
