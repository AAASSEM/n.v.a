import sqlite3

conn = sqlite3.connect("esg_portal.db", detect_types=sqlite3.PARSE_DECLTYPES)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("PRAGMA table_info(user_profiles);")
    columns = cur.fetchall()
    print("Columns:", [dict(c) for c in columns])
    
    cur.execute("SELECT * FROM users WHERE id = 14;")
    row1 = cur.fetchone()
    print("User 14:", dict(row1) if row1 else None)
    
    cur.execute("SELECT * FROM user_profiles WHERE user_id = 14;")
    row2 = cur.fetchone()
    print("Profile 14:", dict(row2) if row2 else None)
except Exception as e:
    print("Error:", e)
