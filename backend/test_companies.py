import requests

login_res = requests.post('http://localhost:8000/api/v1/auth/login', data={'username':'admin@esgportal.com', 'password':'admin123'})
token = login_res.json().get('access_token')

if token:
    res = requests.post(
        'http://localhost:8000/api/v1/companies/',
        headers={'Authorization': f'Bearer {token}'},
        json={"name": "Test", "company_code": "TST", "emirate": "Dubai", "sector": "Other"}
    )
    print(res.status_code)
    print(res.text)
else:
    print('Failed to get token')
