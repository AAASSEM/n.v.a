import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_active_user
from app.models.user import User, UserProfile
from app.models.company import Company
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

mock_user = User(id=1, email="test@example.com")
mock_user.profile = UserProfile(company_id=1, role="admin")

async def override_get_current_active_user():
    return mock_user

app.dependency_overrides[get_current_active_user] = override_get_current_active_user

client = TestClient(app)
response = client.get("/api/v1/profiling/checklist/me")

print(f"Status: {response.status_code}")
items = response.json()
if len(items) > 0:
    for i in items[:3]:
        print(f"Element: {i['element_name']} | FW: {i['frameworks']}")
