import requests
import sqlite3

def run_test():
    url = "http://localhost:8000/api/v1/auth/request-login-link"
    payload = {"email": "super@apex.demo"}
    print(f"Sending request to: {url} with email: {payload['email']}")
    try:
        response = requests.post(url, json=payload)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.json()}")
    except Exception as e:
        print(f"HTTP request failed: {e}")
        return

    # Check the database
    conn = sqlite3.connect("esg_portal.db")
    c = conn.cursor()
    c.execute("SELECT token, token_type, verification_code, used_at FROM email_verification_tokens ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    if row:
        token, token_type, verification_code, used_at = row
        print(f"Latest token in DB:")
        print(f"  Token: {token}")
        print(f"  Type: {token_type}")
        print(f"  Code: {verification_code}")
        print(f"  Used At: {used_at}")
    else:
        print("No tokens found in DB.")
    conn.close()

if __name__ == "__main__":
    run_test()
