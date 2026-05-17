import sqlite3
import json
from app.core.seed_data import SEED_DATA

conn = sqlite3.connect('esg_portal.db')
c = conn.cursor()
for i, de in enumerate(SEED_DATA["des"]):
    try:
        c.execute("""
            INSERT INTO data_elements (element_code, name, category, description, unit, collection_frequency, condition_logic, frameworks, is_metered, meter_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            de.get("element_code"),
            de.get("name"),
            de.get("category"),
            de.get("description"),
            de.get("unit"),
            de.get("collection_frequency"),
            de.get("condition_logic"),
            de.get("frameworks"),
            de.get("is_metered"),
            de.get("meter_type")
        ))
        conn.commit()
    except Exception as e:
        print(f"Error on {de['element_code']}: {e}")
        conn.rollback()

conn.close()
