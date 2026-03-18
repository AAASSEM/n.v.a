import sqlite3
import pandas as pd

conn = sqlite3.connect('esg_portal.db')
query = '''
    SELECT u.id, u.email, u.first_name, u.last_name, p.role 
    FROM users u 
    LEFT JOIN user_profiles p ON u.id = p.user_id 
    WHERE u.first_name LIKE '%lyla%' OR u.email LIKE '%lyla%'
'''
df = pd.read_sql_query(query, conn)
print(df)
conn.close()
