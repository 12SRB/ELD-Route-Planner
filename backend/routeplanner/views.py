import json
import urllib.request
import urllib.parse
import urllib.error

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .hos_calculator import calculate_trip_schedule


# ── Geocoding via Nominatim ────────────────────────────────────────
def geocode_location(query: str) -> dict:
    """Geocode a location string using OSM Nominatim (free, no key)."""
    encoded = urllib.parse.quote(query)
    url = (
        f"https://nominatim.openstreetmap.org/search"
        f"?format=json&limit=1&q={encoded}&addressdetails=1"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "TruckLogPro/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    if not data:
        raise ValueError(f"Location not found: '{query}'")
    item = data[0]
    addr = item.get("address", {})
    short_name = ", ".join(filter(None, [
        addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county"),
        addr.get("state"),
        addr.get("country_code", "").upper()
    ]))
    return {
        "lat":  float(item["lat"]),
        "lon":  float(item["lon"]),
        "name": short_name or item["display_name"].split(",")[0]
    }


# ── OSRM Routing ───────────────────────────────────────────────────
def get_osrm_route(coords: list) -> dict:
    """Get driving route from OSRM (free public API)."""
    waypoints = ";".join(f"{c['lon']},{c['lat']}" for c in coords)
    url = (
        f"https://router.project-osrm.org/route/v1/driving/{waypoints}"
        f"?overview=full&geometries=geojson&steps=false"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "TruckLogPro/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    if data.get("code") != "Ok":
        raise ValueError("Routing failed — check location inputs.")
    route = data["routes"][0]
    return {
        "distance_m":  route["distance"],
        "duration_s":  route["duration"],
        "geometry":    route["geometry"]["coordinates"],  # [[lon, lat], ...]
        "distance_mi": route["distance"] * 0.000621371,
    }


# ── API Endpoints ──────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def plan_trip(request):
    """
    POST /api/plan-trip/
    Body (JSON):
      {
        "current_location": "Chicago, IL",
        "pickup_location":  "St. Louis, MO",
        "dropoff_location": "Dallas, TX",
        "cycle_hours_used": 14,
        "driver_name":      "John Doe",       (optional)
        "carrier_name":     "ACME Trucking"   (optional)
      }
    Returns route + HOS schedule.
    """
    # CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({})
        _add_cors(response)
        return response

    try:
        body = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return _error("Invalid JSON body.", 400)

    current_loc = body.get("current_location", "").strip()
    pickup_loc  = body.get("pickup_location",  "").strip()
    dropoff_loc = body.get("dropoff_location", "").strip()
    cycle_used  = float(body.get("cycle_hours_used", 0))
    driver_name = body.get("driver_name", "Driver").strip()
    carrier_name = body.get("carrier_name", "Motor Carrier").strip()

    if not current_loc or not pickup_loc or not dropoff_loc:
        return _error("All three location fields are required.", 400)
    if not (0 <= cycle_used <= 70):
        return _error("Cycle hours used must be between 0 and 70.", 400)

    try:
        # 1. Geocode all three locations
        start_coord   = geocode_location(current_loc)
        pickup_coord  = geocode_location(pickup_loc)
        dropoff_coord = geocode_location(dropoff_loc)

        # 2. Get driving route
        route = get_osrm_route([start_coord, pickup_coord, dropoff_coord])
        total_miles = route["distance_mi"]

        # 3. Calculate HOS schedule
        schedule = calculate_trip_schedule(total_miles, cycle_used)

        response_data = {
            "success": True,
            "locations": {
                "start":   start_coord,
                "pickup":  pickup_coord,
                "dropoff": dropoff_coord,
            },
            "route": {
                "geometry":    route["geometry"],
                "distance_mi": round(total_miles, 1),
                "duration_s":  route["duration_s"],
            },
            "schedule":   schedule,
            "meta": {
                "driver_name":  driver_name,
                "carrier_name": carrier_name,
            }
        }
        resp = JsonResponse(response_data)
        _add_cors(resp)
        return resp

    except ValueError as ve:
        return _error(str(ve), 400)
    except urllib.error.URLError as ue:
        return _error(f"Network error: {ue.reason}", 502)
    except Exception as ex:
        return _error(f"Server error: {str(ex)}", 500)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def calculate_hos_only(request):
    """
    POST /api/calculate-hos/
    Lightweight endpoint — accepts pre-computed mileage.
    Body: { "total_miles": 1200, "cycle_hours_used": 14 }
    """
    if request.method == "OPTIONS":
        response = JsonResponse({})
        _add_cors(response)
        return response

    try:
        body = json.loads(request.body.decode("utf-8"))
        total_miles = float(body.get("total_miles", 0))
        cycle_used  = float(body.get("cycle_hours_used", 0))
        if total_miles <= 0:
            return _error("total_miles must be > 0", 400)
        if not (0 <= cycle_used <= 70):
            return _error("cycle_hours_used must be 0–70", 400)

        schedule = calculate_trip_schedule(total_miles, cycle_used)
        resp = JsonResponse({"success": True, "schedule": schedule})
        _add_cors(resp)
        return resp
    except Exception as ex:
        return _error(str(ex), 500)


@require_http_methods(["GET"])
def health_check(request):
    resp = JsonResponse({"status": "ok", "service": "TruckLog Pro API"})
    _add_cors(resp)
    return resp


# ── Helpers ────────────────────────────────────────────────────────
def _error(msg: str, status: int = 400):
    resp = JsonResponse({"success": False, "error": msg}, status=status)
    _add_cors(resp)
    return resp


def _add_cors(response):
    response["Access-Control-Allow-Origin"]  = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response
