import json
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import engine, Base
from sqlalchemy.orm import sessionmaker

# We just want to call the dashboard/metrics endpoint without auth.
# Wait, TestClient still requires Auth if the endpoint has Depends(get_current_user).
# Let's override the dependency.
from app.api.deps import get_current_user

def override_get_current_user():
    class MockUser:
        id = 1
        company_id = 1
    return MockUser()

app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

response = client.get("/api/v1/dashboard/metrics?pillar=E&site_id=1")
print(response.status_code)
if response.status_code == 200:
    data = response.json()
    print(json.dumps(data.get('stats', [])[:2], indent=2))
else:
    print(response.text)
