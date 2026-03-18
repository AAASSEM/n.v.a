import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_active_user
from app.models.user import User, UserProfile

mock_user = User(id=1, email="test@example.com")
mock_user.profile = UserProfile(company_id=1, role="admin")

async def override_get_current_active_user():
    return mock_user

app.dependency_overrides[get_current_active_user] = override_get_current_active_user

client = TestClient(app)

# GET
res = client.get("/api/v1/submissions/grid/2026/3")
print(f"Status GET: {res.status_code}")
if res.status_code == 200:
    for r in res.json()[:3]:
        print(r)

# POST
payload = {
    "year": 2026,
    "month": 3,
    "entries": [
        {"data_element_id": 1, "meter_id": None, "value": 150.5, "notes": "Test Elec"},
        # Meter 43 is Test Sub-Meter from earlier
        {"data_element_id": 2, "meter_id": 43, "value": 500, "notes": "Test Water Sub"} 
    ]
}
res2 = client.post("/api/v1/submissions/bulk", json=payload)
print(f"Status POST: {res2.status_code}")
print(res2.json())
