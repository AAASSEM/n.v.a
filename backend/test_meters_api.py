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

res = client.get("/api/v1/meters/me")
print(f"Status GET /meters/me: {res.status_code}")
if res.status_code == 200:
    meters = res.json()
    print(f"Loaded {len(meters)} meters.")
    if len(meters) > 0:
        print(f"Sample: {meters[0]['name']}")
