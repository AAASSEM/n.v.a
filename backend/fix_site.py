import sqlite3
import datetime

conn = sqlite3.connect('esg_portal.db')
c = conn.cursor()
c.execute("INSERT INTO sites (company_id, name, location, is_active, created_at) VALUES (2, 'Main Site', 'Dubai', 1, ?)", (datetime.datetime.now(),))
conn.commit()
print("Site created successfully")
conn.close()
