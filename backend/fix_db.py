import sqlite3

conn = sqlite3.connect('esg_portal.db')
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("Tables:", tables)

# Check companies columns
if 'companies' in tables:
    cols = [r[1] for r in conn.execute("PRAGMA table_info(companies)")]
    print("Companies columns:", cols)
    if 'trial_expires_at' not in cols:
        conn.execute("ALTER TABLE companies ADD COLUMN trial_expires_at DATETIME")
        conn.commit()
        print("Added trial_expires_at column!")
    else:
        print("trial_expires_at already exists")

# Drop any leftover temp tables from failed migrations
for t in tables:
    if t.startswith('_alembic_tmp_'):
        conn.execute(f"DROP TABLE IF EXISTS {t}")
        conn.commit()
        print(f"Dropped temp table: {t}")

conn.close()
print("Done.")
