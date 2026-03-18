import pandas as pd
import json

file_path = r'c:\Users\20100\thefinal\n.v.a\24sep-hospitality-ESG-DST-GK.xlsx'

try:
    df = pd.read_excel(file_path)
    print("Columns:")
    print(df.columns.tolist())
    print("\nFirst 3 rows:")
    # convert to json for easy reading
    print(df.head(3).to_json(orient='records', indent=2))
except Exception as e:
    print(f"Error reading excel: {e}")
