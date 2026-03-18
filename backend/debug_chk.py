import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.company import Company
from app.models.profiling import CompanyProfileAnswer, ProfilingQuestion
from app.models.data_element import DataElement

async def debug():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Check an active company
        stmt_comp = select(Company).limit(1)
        company = (await db.execute(stmt_comp)).scalars().first()
        if not company:
            print("No companies found")
            return
            
        print(f"Company: {company.name}, active_frameworks: {company.active_frameworks}")
        
        # Check its raw answers
        stmt_ans = select(CompanyProfileAnswer).where(CompanyProfileAnswer.company_id == company.id)
        answers = (await db.execute(stmt_ans)).scalars().all()
        print(f"Answers count: {len(answers)}")
        
        for ans in answers:
            print(f"QID {ans.question_id}: {ans.answer}")
            
        # Check questions joined to true answers
        stmt_true_qs = select(ProfilingQuestion.question_text).join(CompanyProfileAnswer).where(
            CompanyProfileAnswer.company_id == company.id,
            CompanyProfileAnswer.answer == True
        )
        active_conditions = set((await db.execute(stmt_true_qs)).scalars().all())
        print(f"Active condition text matches: {active_conditions}")

        # Check total elements and a sample of condition_logic
        all_elements = (await db.execute(select(DataElement))).scalars().all()
        print(f"Total elements: {len(all_elements)}")
        for e in all_elements[:5]:
            print(f"- {e.element_code}: {e.condition_logic} (FW: {e.frameworks})")

if __name__ == '__main__':
    asyncio.run(debug())
