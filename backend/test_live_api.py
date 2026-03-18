import json
import urllib.request
import urllib.error

url = 'http://localhost:8000/api/v1/profiling/answers'
payload = {
    "company_id": 1,
    "answers": [
        {"question_id": 1, "answer": True}
    ]
}
data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={
    'Content-Type': 'application/json'
})

try:
    with urllib.request.urlopen(req) as res:
        print(f"Status: {res.status}")
        print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.reason}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
