import urllib.request
import json
import urllib.error

req = urllib.request.Request('http://127.0.0.1:8000/api/v1/dashboard/metrics?site_id=1&pillar=E')
# We need authorization. Let's see if we can bypass or just read the code to see if there's a hardcoded token or if we can use an internal function directly.
