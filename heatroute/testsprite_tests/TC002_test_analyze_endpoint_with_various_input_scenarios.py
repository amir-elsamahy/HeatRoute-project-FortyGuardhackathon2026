import requests

BASE_URL = "http://localhost:5173"
ANALYZE_ENDPOINT = f"{BASE_URL}/api/analyze"
TIMEOUT = 30

def test_analyze_endpoint_with_various_input_scenarios():
    """
    Verify POST /api/analyze returns:
    - 200 with ranked route candidates and heat statistics for valid supported coordinates
    - 400 or 422 with controlled errors for unsupported or invalid coordinates
    - Proper handling of route-not-found or analysis-limit errors with appropriate status codes and messages.
    """
    headers = {"Content-Type": "application/json"}

    # Sample payloads based on the PRD and test description

    # 1. Valid supported coordinates example (Alabama, USA)
    valid_payload = {
        "origin": {"lat": 34.730369, "lon": -86.586104},   # Huntsville, AL approx
        "destination": {"lat": 34.75, "lon": -86.6}  # More distinct destination
    }

    # 2. Unsupported coordinates (e.g., outside the supported US region)
    unsupported_payload = {
        "origin": {"lat": 48.8566, "lon": 2.3522},  # Paris, France
        "destination": {"lat": 48.8584, "lon": 2.2945}  # Eiffel Tower coords
    }

    # 3. Invalid coordinates (lat or lon out of valid range, or nonsensical values)
    invalid_payload = {
        "origin": {"lat": 1000, "lon": -2000},  # invalid coordinates
        "destination": {"lat": -1000, "lon": 2000}
    }

    # 4. Coordinates leading to route-not-found or analysis-limit error
    # Assuming this is a known edge case where no route can be computed,
    # using coordinates in a remote or disconnected area (e.g., middle of ocean)
    route_not_found_payload = {
        "origin": {"lat": 0.0, "lon": 0.0},
        "destination": {"lat": 0.1, "lon": 0.1}
    }

    def post_analyze(payload):
        try:
            response = requests.post(ANALYZE_ENDPOINT, json=payload, headers=headers, timeout=TIMEOUT)
            return response
        except requests.RequestException as e:
            assert False, f"Request failed: {e}"

    # Test 1: Valid supported coordinates -> expect 200 and response structure with ranked routes and heat stats
    resp_valid = post_analyze(valid_payload)
    assert resp_valid.status_code == 200, f"Expected 200 for valid coords but got {resp_valid.status_code}"
    valid_data = resp_valid.json()
    # Validate expected keys in the response
    assert "rankedRoutes" in valid_data, "Missing 'rankedRoutes' in response"
    assert isinstance(valid_data["rankedRoutes"], list) and valid_data["rankedRoutes"], "'rankedRoutes' should be a non-empty list"
    assert "heatStats" in valid_data, "Missing 'heatStats' in response"
    assert isinstance(valid_data["heatStats"], dict), "'heatStats' should be a dictionary"

    # Test 2: Unsupported coordinates -> expect 400 or 422 with controlled error message
    resp_unsupported = post_analyze(unsupported_payload)
    assert resp_unsupported.status_code in (400, 422), f"Expected 400 or 422 for unsupported coords but got {resp_unsupported.status_code}"
    unsupported_data = resp_unsupported.json()
    assert "error" in unsupported_data or "message" in unsupported_data, "Controlled error message expected in response"

    # Test 3: Invalid coordinates -> expect 400 or 422 with validation error message
    resp_invalid = post_analyze(invalid_payload)
    assert resp_invalid.status_code in (400, 422), f"Expected 400 or 422 for invalid coords but got {resp_invalid.status_code}"
    invalid_data = resp_invalid.json()
    assert "error" in invalid_data or "message" in invalid_data, "Validation error message expected in response"

    # Test 4: Route not found or analysis-limit error -> expect 4xx or 5xx controlled failure with error message
    resp_route_not_found = post_analyze(route_not_found_payload)
    assert resp_route_not_found.status_code >= 400, f"Expected 4xx or 5xx for route-not-found or analysis-limit but got {resp_route_not_found.status_code}"
    route_not_found_data = resp_route_not_found.json()
    assert "error" in route_not_found_data or "message" in route_not_found_data, "Route-not-found or analysis-limit error message expected"

test_analyze_endpoint_with_various_input_scenarios()
