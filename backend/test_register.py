import requests

try:
    res = requests.post('http://localhost:8000/api/v1/auth/register', json={
        "email": "testcors@example.com",
        "password": "password123",
        "first_name": "Test",
        "last_name": "Cors",
        "is_active": True
    })
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Request failed: {e}")
