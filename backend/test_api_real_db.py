import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_active_user
from app.models.user import User, UserProfile

# We'll hit the real database by NOT overriding get_db

mock_user = User(id=1, email="test@example.com")
mock_user.profile = UserProfile(company_id=1, role="admin")

async def override_get_current_active_user():
    return mock_user

app.dependency_overrides[get_current_active_user] = override_get_current_active_user

client = TestClient(app)

response = client.post("/api/v1/profiling/answers", json={
    "answers": [],
    "company_id": 1
})

print(f"Status: {response.status_code}")
print(response.json())
