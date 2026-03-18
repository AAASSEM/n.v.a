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

# Let's try sending exactly what the frontend is sending
payload = {
    "answers": [
        {"question_id": 1, "answer": True},
        {"question_id": 2, "answer": False}
    ],
    "company_id": "1" # Notice string vs int!
}

print("Testing payload:", payload)
response = client.post("/api/v1/profiling/answers", json=payload)

print(f"Status: {response.status_code}")
print(response.json())
