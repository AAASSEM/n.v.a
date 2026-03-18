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

payload = {
    "data_element_id": 2,  
    "name": "Test Sub-Meter",
    "account_number": "123",
    "location": "Roof"
}

res = client.post("/api/v1/meters/", json=payload)
print(f"Status POST /meters/: {res.status_code}")
print(res.json())

