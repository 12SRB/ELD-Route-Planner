# 🚛 TruckLog Pro — ELD Route Planner & Driver Daily Log Generator

A full-stack web application built with **Django** (backend) and **React** (frontend) that calculates truck routes, applies FMCSA Hours of Service (HOS) rules, and generates complete Driver Daily Log (ELD) sheets automatically.

---

## 📋 Project Overview

| Item | Details |
|------|---------|
| **Backend** | Python 3.10+ · Django 4.2 |
| **Frontend** | React 18 · Leaflet.js |
| **Map API** | OpenStreetMap (Nominatim) · OSRM (free, no key required) |
| **HOS Rule** | FMCSA 49 CFR §395 — Property Carrier · 70hr/8day |
| **Deployment** | Render (backend) · Vercel (frontend) |

---

## 🎯 App Inputs & Outputs

### Inputs (as required by assessment)
| Input | Description |
|-------|-------------|
| Current Location | Driver's starting point (city, state) |
| Pickup Location | Shipper / load pickup address |
| Dropoff Location | Consignee / delivery destination |
| Current Cycle Used (Hrs) | Hours already used in the 70-hr/8-day cycle (0–70) |

### Outputs
| Output | Description |
|--------|-------------|
| Route Map | Interactive map with route, pickup, dropoff, fuel stops, rest breaks |
| Trip Summary | Distance, drive time, days, fuel stops, cycle remaining |
| Driver Daily Logs | Full FMCSA-format ELD canvas drawings — one per day |

---

## ⚡ HOS Rules Applied (FMCSA §395)

- ✅ **11-hour driving limit** per shift
- ✅ **14-hour duty window** from start of shift
- ✅ **10 consecutive hours off** between shifts
- ✅ **30-minute rest break** required after 8 cumulative driving hours
- ✅ **70-hour / 8-day cycle** limit (property carrier)
- ✅ **Fuel stop every 1,000 miles** (per assessment assumption)
- ✅ **1 hour for pickup and dropoff** (per assessment assumption)
- ✅ Pre-trip and post-trip inspections logged as On Duty (Not Driving)

---

## 🚀 Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

---

### Backend (Django)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate     # Mac/Linux
# OR
venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations (creates SQLite db)
python manage.py migrate

# Start Django development server (port 8000)
python manage.py runserver
```

Backend will be available at: `http://localhost:8000`

---

### Frontend (React)

```bash
# Open a new terminal tab
cd frontend

# Install dependencies
npm install

# Start React dev server (port 3000)
npm start
```

Frontend will be available at: `http://localhost:3000`

> **Note:** The React app is pre-configured to proxy API calls to `http://localhost:8000` via the `"proxy"` setting in `package.json`. Make sure Django is running first.

---

## 🔌 API Endpoints

### `POST /api/plan-trip/`
Main endpoint — geocodes locations, calculates route, applies HOS rules.

**Request body:**
```json
{
  "current_location":  "Chicago, IL",
  "pickup_location":   "St. Louis, MO",
  "dropoff_location":  "Dallas, TX",
  "cycle_hours_used":  14,
  "driver_name":       "John Doe",
  "carrier_name":      "ACME Trucking Co."
}
```

**Response:**
```json
{
  "success": true,
  "locations": { "start": {...}, "pickup": {...}, "dropoff": {...} },
  "route": {
    "geometry": [[lon, lat], ...],
    "distance_mi": 855.2,
    "duration_s": 55800
  },
  "schedule": {
    "days": [...],
    "fuel_stops": [...],
    "rest_stops": [...],
    "trip_stats": {...}
  },
  "meta": { "driver_name": "...", "carrier_name": "..." }
}
```

### `POST /api/calculate-hos/`
Lightweight — skips geocoding, just calculates HOS from mileage.
```json
{ "total_miles": 1200, "cycle_hours_used": 14 }
```

### `GET /api/health/`
Health check endpoint.

---

## 🌐 Deployment

### Deploy Backend to Render

1. Create account at [render.com](https://render.com)
2. New → Web Service → Connect your GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn trucking_backend.wsgi:application`
4. Add environment variable: `SECRET_KEY=your-secret-key-here`
5. Add your Render domain to `ALLOWED_HOSTS` in `settings.py`

### Deploy Frontend to Vercel

1. Create account at [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Create React App
4. Add environment variable:
   - `REACT_APP_API_URL=https://your-backend.onrender.com/api`
5. Deploy!

---

## 📁 Project Structure

```
trucking-app/
├── README.md
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── trucking_backend/
│   │   ├── __init__.py
│   │   ├── settings.py       ← Django config + CORS
│   │   ├── urls.py           ← Main URL routing
│   │   └── wsgi.py
│   └── routeplanner/
│       ├── __init__.py
│       ├── apps.py
│       ├── urls.py           ← API routes
│       ├── views.py          ← Geocoding, routing, API logic
│       └── hos_calculator.py ← Core FMCSA HOS engine
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── index.css         ← Global styles
        ├── App.js            ← Root component + state
        ├── App.css           ← Layout + shared styles
        └── components/
            ├── TripForm.jsx      ← Input form
            ├── TripForm.css
            ├── RouteMap.jsx      ← Leaflet map component
            ├── RouteMap.css
            ├── TripSummary.jsx   ← Stats panel
            ├── TripSummary.css
            ├── ELDLogs.jsx       ← ELD canvas renderer
            └── ELDLogs.css
```

---

## 📝 ELD Log Sheet Details

Each generated log sheet includes (per FMCSA §395.8):

- ✅ Date (Month/Day/Year)
- ✅ Driver name & carrier name
- ✅ From/To locations
- ✅ Total miles driving today
- ✅ Vehicle number
- ✅ 24-hour graph grid with 4 duty status rows
- ✅ 15-minute increment tick marks
- ✅ Activity lines with vertical connectors at status changes
- ✅ Total hours column per row
- ✅ Remarks section with duty status change locations/times
- ✅ Recapitulation (On Duty, Driving, Off Duty totals)
- ✅ Driver signature line

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend API | Django 4.2 | REST endpoints, HOS calculation |
| CORS | django-cors-headers | Allow React → Django requests |
| Frontend | React 18 | SPA with component architecture |
| Map | Leaflet + React-Leaflet | Interactive route map |
| Routing API | OSRM (free) | Turn-by-turn route geometry |
| Geocoding | Nominatim/OSM (free) | Location → coordinates |
| ELD Drawing | HTML Canvas (vanilla JS) | FMCSA log sheet rendering |
| Deployment | Render + Vercel | Free-tier hosting |

---

## 🎥 Loom Video Outline (3–5 min)

1. **Overview** (30s) — What the app does and why
2. **Demo** (2 min) — Enter trip details → Generate → Show map + stops + logs
3. **Code walkthrough** (1.5 min):
   - `hos_calculator.py` — HOS rules engine
   - `views.py` — API + geocoding/routing
   - `ELDLogs.jsx` — Canvas ELD drawing
4. **Wrap up** (30s) — Deployment links

---

## 📞 References

- [FMCSA HOS Guide (2022)](https://www.fmcsa.dot.gov/regulations/hours-service)
- [49 CFR Part 395](https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395)
- [OpenStreetMap](https://www.openstreetmap.org) · [OSRM](http://project-osrm.org)
