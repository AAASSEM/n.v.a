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
        stmt_comp = select(Company).limit(1)
        company = (await db.execute(stmt_comp)).scalars().first()
        
        # Simulated active frameworks
        active_frameworks = ['esg', 'dst', 'green key']
        print(f"Active Frameworks: {active_frameworks}")
        
        qs = (await db.execute(select(ProfilingQuestion))).scalars().all()
        # Simulated answers: all True
        active_conditions = set([q.question_text for q in qs])
        
        stmt = select(DataElement).where(DataElement.category.in_(["E", "S", "G"]))
        all_elements = (await db.execute(stmt)).scalars().all()
        
        count = 0
        missing = []
        
        for element in all_elements:
            framework_match = False
            if element.frameworks:
                fw_map = {"e": "esg", "d": "dst", "g": "green key"}
                element_fws = []
                for f in element.frameworks.split(','):
                    f_clean = f.strip().lower()
                    if f_clean in fw_map:
                        element_fws.append(fw_map[f_clean])
                    else:
                        element_fws.append(f_clean)
                
                if any(fw in active_frameworks for fw in element_fws):
                    framework_match = True
            else:
                framework_match = True
                
            condition_match = False
            if not element.condition_logic:
                condition_match = True
            else:
                if element.condition_logic in active_conditions:
                    condition_match = True
                    
            if framework_match and condition_match:
                count += 1
            else:
                missing.append((element.element_code, element.frameworks, element.condition_logic, framework_match, condition_match))
                
        print(f"Total passed: {count}")
        print("Missing Elements:")
        for m in missing:
            print(f"- {m[0]} | fws: '{m[1]}' | cond: '{m[2]}' | fw_match: {m[3]} | cond_match: {m[4]}")

if __name__ == '__main__':
    asyncio.run(debug())
