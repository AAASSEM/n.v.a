import sqlite3

conn = sqlite3.connect('esg_portal.db')
c = conn.cursor()
c.execute("SELECT element_code, name, unit, frameworks FROM data_elements WHERE category='E' ORDER BY frameworks, name")
rows = c.fetchall()
for r in rows:
    print(f"{r[0]:20s} | {r[1]:50s} | {r[2]:10s} | {r[3]}")
conn.close()
