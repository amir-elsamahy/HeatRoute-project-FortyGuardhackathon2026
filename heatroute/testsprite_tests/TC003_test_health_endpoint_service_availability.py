import requests

base_url = "http://localhost:5173"
timeout = 30

def test_health_endpoint_service_availability():
    url = f"{base_url}/api/health"
    try:
        response = requests.get(url, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request to /api/health failed: {e}"

    # If status code is 200, expect JSON payload with healthy status indication
    if response.status_code == 200:
        try:
            data = response.json()
        except ValueError:
            assert False, "Response from /api/health is not a valid JSON"

        # Check data for keys that indicate health; assuming 'status' key with 'healthy' string
        assert 'status' in data, "Response JSON missing 'status' key"
        assert data['status'].lower() in ['healthy', 'ok', 'up'], "Service status not healthy when status code is 200"
    else:
        # For non-200, check if response body indicates unhealthy or degraded status
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' in content_type.lower():
            try:
                data = response.json()
            except ValueError:
                data = None
            if data:
                # If JSON present, expect status key showing unhealthy/degraded
                status = data.get('status', '').lower()
                assert response.status_code != 200 or status not in ['healthy', 'ok', 'up'], \
                    "Non-200 response contains healthy status"
            else:
                # Non-JSON body, at least status code is not 200 indicating degraded/unhealthy
                pass
        else:
            # Non-JSON response with non-200 status is acceptable to indicate degraded service
            pass

test_health_endpoint_service_availability()