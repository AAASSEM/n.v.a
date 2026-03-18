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
    "email": "newuser@example.com",
    "first_name": "New",
    "last_name": "User",
    "password": "Password123!",
    "role": "viewer"
}
res = client.post("/api/v1/users/invite", json=payload)
print(f"Status POST: {res.status_code}")
print(res.json())
