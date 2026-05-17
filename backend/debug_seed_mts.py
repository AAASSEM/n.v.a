import sqlite3
import json
from app.core.seed_data import SEED_DATA

conn = sqlite3.connect('esg_portal.db')
c = conn.cursor()
for i, m in enumerate(SEED_DATA["mts"]):
    try:
        c.execute("""
            INSERT INTO meter_types (name, unit, category, description)
            VALUES (?, ?, ?, ?)
        """, (
            m.get("name"),
            m.get("unit"),
            m.get("category"),
            m.get("description")
        ))
        conn.commit()
    except Exception as e:
        print(f"Error on {m['name']}: {e}")
        conn.rollback()

conn.close()
