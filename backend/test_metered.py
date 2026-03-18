import sqlite3
import pandas as pd

conn = sqlite3.connect('esg_portal.db')
query = 'SELECT id, name, is_metered FROM data_elements WHERE is_metered = 1'
df = pd.read_sql_query(query, conn)
print("Metered elements:", len(df))
print(df.head())
conn.close()
