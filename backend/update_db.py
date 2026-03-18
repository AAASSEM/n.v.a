import sqlite3
c = sqlite3.connect('esg_portal.db')
try:
    c.execute('ALTER TABLE companies ADD COLUMN registration_number VARCHAR(100);')
    c.execute('ALTER TABLE companies ADD COLUMN trade_license_number VARCHAR(100);')
    c.commit()
    print('Columns added')
except Exception as e:
    print(e)
c.close()
