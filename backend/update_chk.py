import sqlite3
c = sqlite3.connect('esg_portal.db')
try:
    c.execute('ALTER TABLE company_checklists ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;')
    c.commit()
    print('Column assigned_to added')
except Exception as e:
    print(e)
c.close()
