import sqlite3

try:
    c = sqlite3.connect('esg_portal.db')
    
    # 1. Rename existing table
    c.execute("ALTER TABLE data_submissions RENAME TO data_submissions_old")
    
    # 2. Create new table with updated unique constraint
    c.execute('''
    CREATE TABLE data_submissions (
        id INTEGER NOT NULL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        site_id INTEGER,
        data_element_id INTEGER NOT NULL,
        meter_id INTEGER,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        value NUMERIC(20, 4),
        unit VARCHAR(50),
        notes TEXT,
        evidence_files TEXT,
        submitted_by INTEGER,
        submitted_at DATETIME,
        updated_at DATETIME,
        CONSTRAINT uq_submission UNIQUE(company_id, data_element_id, meter_id, year, month),
        FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE,
        FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE SET NULL,
        FOREIGN KEY(data_element_id) REFERENCES data_elements (id) ON DELETE CASCADE,
        FOREIGN KEY(meter_id) REFERENCES meters (id) ON DELETE SET NULL,
        FOREIGN KEY(submitted_by) REFERENCES users (id) ON DELETE SET NULL
    )
    ''')
    
    # 3. Copy data
    c.execute('''
    INSERT INTO data_submissions 
    SELECT * FROM data_submissions_old
    ''')
    
    # 4. Drop old table
    c.execute("DROP TABLE data_submissions_old")
    
    c.commit()
    print("Successfully updated data_submissions table constraint!")
except Exception as e:
    print(f"Error: {e}")
finally:
    c.close()
