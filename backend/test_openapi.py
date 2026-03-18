import requests
import json

try:
    res = requests.get('http://localhost:8000/api/v1/openapi.json', timeout=5)
    data = res.json()
    paths = list(data.get('paths', {}).keys())
    print("Paths containing auth:")
    for p in paths:
        if 'auth' in p:
            print(p)
except Exception as e:
    print(f"Error: {e}")
