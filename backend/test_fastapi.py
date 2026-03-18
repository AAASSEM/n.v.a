import asyncio
from fastapi.testclient import TestClient
from app.main import app

def run_test():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test4000@example.com",
                "password": "pwd",
                "first_name": "Test",
                "last_name": "User",
                "is_active": True
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == '__main__':
    run_test()
