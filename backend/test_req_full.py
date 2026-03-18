import urllib.request
import urllib.error
import json

data = json.dumps({
    "email": "blerg3@example.com",
    "password": "pwd",
    "first_name": "Blerg",
    "last_name": "Blarg",
    "is_active": True
}).encode('utf-8')

req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/register',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    print(e.read().decode('utf-8'))
