import requests

login_res = requests.post('http://localhost:8000/api/v1/auth/login', data={'username':'admin@esgportal.com', 'password':'admin123'})
token = login_res.json().get('access_token')

if token:
    res = requests.get(
        'http://localhost:8000/api/v1/auth/me',
        headers={'Authorization': f'Bearer {token}'}
    )
    print(res.text)
else:
    print('Failed to get token')
