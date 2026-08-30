import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30


def test_geocode_endpoint_with_valid_and_invalid_queries():
    geocode_url = f"{BASE_URL}/api/geocode"
    headers = {
        "Accept": "application/json"
    }

    # Test valid query - expect 200 and location suggestions with coordinates
    valid_query = "Huntsville, AL"
    params_valid = {"query": valid_query}

    try:
        response_valid = requests.get(geocode_url, headers=headers, params=params_valid, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Valid query request failed: {e}"

    assert response_valid.status_code == 200, f"Expected 200 for valid query, got {response_valid.status_code}"
    try:
        json_valid = response_valid.json()
    except ValueError:
        assert False, "Response for valid query is not valid JSON"

    # Expecting a list or object containing location suggestions with coordinates
    # Validate that at least one suggestion exists and has coordinates
    assert isinstance(json_valid, (list, dict)), "Response JSON should be list or dict for valid query"

    if isinstance(json_valid, list):
        assert len(json_valid) > 0, "No location suggestions returned for valid query"
        suggestion = json_valid[0]
    else:
        # dict-type response - check if it contains suggestions or items
        suggestion = None
        # Attempt to find a suggestion object inside dict
        if "results" in json_valid:
            assert isinstance(json_valid["results"], list), "'results' field is not a list"
            assert len(json_valid["results"]) > 0, "No location suggestions in 'results'"
            suggestion = json_valid["results"][0]
        else:
            suggestion = json_valid

    assert suggestion is not None, "No suggestive location object found in valid query response"
    # Check that coordinates fields exist
    coord_keys = ['lat', 'lon', 'latitude', 'longitude']
    assert any(k in suggestion for k in coord_keys), "Suggestion does not contain latitude/longitude fields"

    # Test invalid query - can be 400 or 200 with no usable results
    invalid_query = "12345!"
    params_invalid = {"query": invalid_query}
    try:
        response_invalid = requests.get(geocode_url, headers=headers, params=params_invalid, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Invalid query request failed: {e}"

    # Acceptable codes: 400 (bad request), or 200 (with no usable results)
    assert response_invalid.status_code in (200, 400), f"Unexpected status code for invalid query: {response_invalid.status_code}"

    if response_invalid.status_code == 200:
        try:
            json_invalid = response_invalid.json()
        except ValueError:
            assert False, "Response for invalid query is not valid JSON"

        # Check that no usable location suggestions with coordinates exist
        def has_coords(item):
            return any(k in item for k in ['lat', 'lon', 'latitude', 'longitude'])

        results_list = []
        if isinstance(json_invalid, list):
            results_list = json_invalid
        elif isinstance(json_invalid, dict):
            if "results" in json_invalid and isinstance(json_invalid["results"], list):
                results_list = json_invalid["results"]
            else:
                # If no 'results' field, treat dict itself as single result
                results_list = [json_invalid] if json_invalid else []
        else:
            results_list = []

        has_valid = any(has_coords(s) for s in results_list)
        # If results exist, they should not contain coords; if empty, it's fine
        assert not (len(results_list) > 0 and has_valid), "Invalid query returned results with coordinates when none expected"
    else:
        # For 400 Bad Request, no further checks required
        pass


test_geocode_endpoint_with_valid_and_invalid_queries()
