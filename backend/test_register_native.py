import json
import urllib.request
import urllib.error

data = json.dumps({
    "email": "testcors2@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "Cors",
    "is_active": True
}).encode('utf-8')

req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/register',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print(f"Status: {response.status}")
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
