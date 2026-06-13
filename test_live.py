import requests

url = "http://127.0.0.1:8000/api/v1/dashboard/metrics?pillar=E&site_id=1"
try:
    # We will get a 401 Unauthorized if it's working and returning normally
    # We will get a 500 if there's an internal server error that escapes the CORS handler
    # We can also get a 500 JSON if it's caught
    response = requests.get(url)
    print("Status:", response.status_code)
    print("Headers:", response.headers)
    print("Text:", response.text)
except Exception as e:
    print("Request failed:", e)
