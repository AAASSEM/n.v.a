import requests
import json

# 1. Login
login_data = {
    "email": "super@apex.demo"
}
r1 = requests.post("http://127.0.0.1:8000/api/v1/auth/demo-login", json=login_data)
if r1.status_code != 200:
    print("Login failed:", r1.text)
    exit(1)
token = r1.json()["access_token"]

# 2. Get score
r2 = requests.get(
    "http://127.0.0.1:8000/api/v1/dashboard/score?site_id=2",
    headers={"Authorization": f"Bearer {token}"}
)
print("Status:", r2.status_code)
print("Response:", r2.text)
