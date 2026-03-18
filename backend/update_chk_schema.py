import sqlite3

try:
    c = sqlite3.connect('esg_portal.db')
    # SQLite does not support ALTER COLUMN ... DROP NOT NULL easily.
    # We must recreate the table or use a PRAGMA hack.
    # The safest way in SQLite is:
    # 1. Rename table
    # 2. Create new table without NOT NULL constraint
    # 3. Copy data
    # 4. Drop old table
    
    # 1. Check schema
    cur = c.cursor()
    
    print("Renaming table...")
    cur.execute("ALTER TABLE company_checklists RENAME TO company_checklists_old")
    
    print("Creating new table...")
    cur.execute('''
    CREATE TABLE company_checklists (
        id INTEGER NOT NULL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        data_element_id INTEGER NOT NULL,
        framework_id INTEGER,
        frequency VARCHAR(20) NOT NULL,
        is_required BOOLEAN,
        assigned_to INTEGER,
        added_at DATETIME,
        FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE,
        FOREIGN KEY(data_element_id) REFERENCES data_elements (id) ON DELETE CASCADE,
        FOREIGN KEY(framework_id) REFERENCES frameworks (id) ON DELETE CASCADE,
        FOREIGN KEY(assigned_to) REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT uq_company_data_element UNIQUE (company_id, data_element_id)
    )
    ''')
    
    print("Copying data...")
    cur.execute('''
    INSERT INTO company_checklists (id, company_id, data_element_id, framework_id, frequency, is_required, assigned_to, added_at)
    SELECT id, company_id, data_element_id, framework_id, frequency, is_required, assigned_to, added_at
    FROM company_checklists_old
    ''')
    
    print("Dropping old table...")
    cur.execute("DROP TABLE company_checklists_old")
    
    # recreate index
    cur.execute("CREATE INDEX ix_company_checklists_id ON company_checklists (id)")
    
    c.commit()
    print("Success")
except Exception as e:
    print(e)
finally:
    c.close()
