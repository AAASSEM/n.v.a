import asyncio
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.data_element import DataElement
from app.models.profiling import ProfilingQuestion
import math

file_path = r'c:\Users\20100\thefinal\n.v.a\24sep-hospitality-ESG-DST-GK.xlsx'

async def seed_excel_data():
    print('Reading Excel file...')
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return
        
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print('Seeding DataElements and ProfilingQuestions...')
        q_order = 1
        
        for index, row in df.iterrows():
            master_id = str(row.get('master_id', '')).strip()
            if not master_id or master_id == 'nan':
                 continue
                 
            # 1. Create DataElement
            name = str(row.get('Data Element Name', '')).strip()
            category = str(row.get('E/S/G', '')).strip()
            prompt = str(row.get('prompt', '')).replace('nan', '').strip()
            unit = str(row.get('unit', '')).replace('nan', '').strip()
            cadence = str(row.get('cadence', 'monthly')).strip()
            metered_raw = str(row.get('Metered (M/NM)', '')).strip()
            is_metered = True if metered_raw == 'M' else False
            
            # Extract conditionals and frameworks first
            condition_type = str(row.get('must-have/conditional', '')).strip().lower()
            wizard_question = str(row.get('wizard_question', '')).replace('nan', '').strip()
            frameworks_raw = str(row.get('Frameworks (E/D/G)', '')).replace('nan', '').strip()
            
            condition_logic = wizard_question if condition_type == 'conditional' and wizard_question else ""

            stmt = select(DataElement).where(DataElement.element_code == master_id)
            existing_element = (await db.execute(stmt)).scalars().first()
            
            if existing_element:
                print(f"Update existing DataElement: {master_id}")
                existing_element.name = name
                existing_element.category = category
                existing_element.description = prompt
                existing_element.unit = unit
                existing_element.collection_frequency = cadence
                existing_element.is_metered = is_metered
                existing_element.condition_logic = condition_logic
                existing_element.frameworks = frameworks_raw
            else:
                print(f"Create DataElement: {master_id}")
                existing_element = DataElement(
                    element_code=master_id,
                    name=name,
                    category=category,
                    description=prompt,
                    unit=unit,
                    collection_frequency=cadence,
                    is_metered=is_metered,
                    condition_logic=condition_logic,
                    frameworks=frameworks_raw
                )
                db.add(existing_element)
            
            await db.commit()
            
            # 2. Extract ProfilingQuestion if conditional
            
            if condition_type == 'conditional' and wizard_question:
                stmt_q = select(ProfilingQuestion).where(ProfilingQuestion.question_text == wizard_question)
                existing_q = (await db.execute(stmt_q)).scalars().first()
                if not existing_q:
                    print(f"Create ProfilingQuestion: {wizard_question[:30]}...")
                    new_q = ProfilingQuestion(
                        question_text=wizard_question,
                        question_order=q_order,
                        frameworks=frameworks_raw,
                        requires_meter=is_metered
                    )
                    db.add(new_q)
                    q_order += 1
                else:
                    # Update existing with frameworks (just in case they were already seeded)
                    existing_q.frameworks = frameworks_raw
            
        await db.commit()
        print('Seeding completed successfully!')

if __name__ == '__main__':
    asyncio.run(seed_excel_data())
