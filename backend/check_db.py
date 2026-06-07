import sqlite3

conn = sqlite3.connect('c:/Users/20100/thefinal/n.v.a/backend/esg_portal.db')
c = conn.cursor()
c.execute("SELECT id, name, active_frameworks FROM companies;")
rows = c.fetchall()
for r in rows:
    print(r)
conn.close()
