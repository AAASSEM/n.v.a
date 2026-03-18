import sqlite3
conn = sqlite3.connect('esg_portal.db')
c = conn.cursor()
c.execute("SELECT email FROM users")
print([row[0] for row in c.fetchall()])
conn.close()
