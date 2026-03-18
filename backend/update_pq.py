import sqlite3
c = sqlite3.connect('esg_portal.db')
try:
    c.execute('ALTER TABLE profiling_questions ADD COLUMN frameworks TEXT;')
    c.commit()
    print('Column frameworks added')
except Exception as e:
    print(e)
c.close()
