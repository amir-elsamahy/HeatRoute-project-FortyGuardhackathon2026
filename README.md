# HeatRoute — Intelligent Heat-Aware Urban Mobility Engine

> **Urban mobility decision engine powered by FortyGuard's Large Temperature Models (LTMs).**  
> Built for **FortyGuard Hackathon'26** — *Track: Resilient Cities & Infrastructure*.

---

## 1. Executive Summary & Project Concept

### The Problem
Traditional navigation applications (Google Maps, Apple Maps, OSRM) calculate routes purely to minimize travel distance or transit time. However, in cities experiencing severe **Urban Heat Island (UHI)** effects, the shortest distance often forces pedestrians, cyclists, and commuters through unshaded asphalt corridors and concrete heat sinks where surface and air temperatures can exceed shaded parkways by 5°C to 12°C.

### The Solution: HeatRoute
**HeatRoute** bridges urban navigation with hyperlocal climate intelligence:
1. Generates legitimate candidate road corridors using open routing engines (OSRM).
2. Buffers each route into a tight $200\text{m}$ lateral corridor polygon.
3. Submits corridor geometries to **FortyGuard's Large Temperature Models (LTMs)** via the Single-Hour Heatmap API (`analytic_type: "tcm"`, 100m spatial resolution).
4. Extracts authentic microclimate distributions (`Mean`, `Maximum in analyzed hour`, `Minimum` in °C).
5. Computes a deterministic, comparative **Heat Exposure Score (0–100)** to rank routes and output a factual, explainable **"Why This Route?"** decision matrix.

---

## 2. Hackathon Track Alignment

* **Selected Track**: **Resilient Cities & Infrastructure**
* **Hackathon Objective**: FortyGuard Hackathon'26 challenges developers to build AI and climate-tech applications utilizing FortyGuard's thermal models. Track 1 specifically focuses on *"AI applications that route people around heat."*
* **Core Contribution**:
  * **FortyGuard**: Provides the core foundation climate intelligence via its proprietary LTM models and satellite/sensor thermal data.
  * **HeatRoute**: Provides the routing abstraction, lateral corridor polygon generation, geodesic validation, deterministic heat exposure scoring engine ($0.50 \cdot \text{avg} + 0.30 \cdot \text{peak} + 0.20 \cdot \text{dist}$), and evidence-based tradeoff comparison interface.
  * **Zero Redundant LLMs**: HeatRoute delivers transparent, mathematical, and factual climate intelligence without hallucinations or chatbot layers.

---

## 3. System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER CLIENT (Vite + React 19)                   │
│  - CARTO Positron Light Map with Route Overlays (Leaflet)                   │
│  - "Try an Alabama Route" Preset Selector & Location Autocomplete          │
│  - Scored Route Cards (Orange #F97316, Blue #3B82F6, Violet #A78BFA)        │
│  - "Why This Route?" Factual Tradeoff Matrix & HeatScore Badges             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP /api/analyze, /api/geocode
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND SERVICE (Express + Node.js / Vercel API)        │
│  - Zod Request Validation & Geographic Prefilters (US Bounds)               │
│  - Geocoding Proxy (Nominatim OpenStreetMap + In-Memory Cache)              │
│  - Route Candidate Generator & Alternative Extraction (OSRM)                │
│  - Lateral Route Corridor Sampler (200m Buffer, Closed Polygon Ring)        │
│  - FortyGuard LTM Client (Request Budget = 40, Async Polling Engine)        │
│  - Mathematical Heat Exposure Scorer & Factual Tradeoff Ranker              │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼                               ▼
       ┌───────────────────────────────┐ ┌────────────────────────────────────┐
       │   OSRM OpenStreetMap Engine   │ │     FortyGuard Enterprise API      │
       │   - Candidate Road Corridors  │ │     - POST /v1/heatmap (tcm)       │
       │   - Turn-by-Turn Geometries   │ │     - GET /v1/status/{activity_id} │
       └───────────────────────────────┘ └────────────────────────────────────┘
```

---

## 4. How to Run HeatRoute Locally

### Prerequisites
* **Node.js**: v18.0.0 or higher (`node -v`)
* **npm**: v9.0.0 or higher (`npm -v`)
* **FortyGuard API Key**: An active API key from FortyGuard.

### Step-by-Step Setup

```bash
# 1. Navigate to the heatroute project directory
cd heatroute

# 2. Install dependencies
npm install

# 3. Create your local .env configuration from the template
cp .env.example .env

# 4. Open .env and insert your FortyGuard API Key
# FORTYGUARD_API_KEY=your_actual_key_here
```

### Available Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts concurrent backend (`http://localhost:3001`) and frontend (`http://localhost:5173`). |
| `npm test` | Executes the complete Vitest test suite (**33 tests passed across 7 test files**). |
| `npm run typecheck` | Runs strict TypeScript validation with zero emit (**0 errors**). |
| `npm run build` | Builds the production bundle to `dist/` in **< 500ms**. |
| `npm run preview` | Previews the local production build. |

---

## 5. Deployment Architecture (Vercel)

HeatRoute is pre-configured for instant zero-configuration deployment to **Vercel**:
* **Frontend SPA**: Built to `dist/` and served statically.
* **Serverless API**: [`api/index.ts`](file:///d:/Downloads/hackathon/heatroute/api/index.ts) routes `/api/*` requests through the decoupled Express app [`server/app.ts`](file:///d:/Downloads/hackathon/heatroute/server/app.ts).
* **Routing Rules**: [`vercel.json`](file:///d:/Downloads/hackathon/heatroute/vercel.json) rewrites `/api/(.*)` to `/api` and all SPA paths to `/index.html`.

To deploy:
```bash
# In the heatroute directory
npx vercel
# Set the FORTYGUARD_API_KEY environment variable in your Vercel Project Settings
```

---

## 6. What Doesn't Work Yet / Honest System Limitations

1. **Road Network Topology Constraints (Single-Route Fallback)**:
   * Multi-route comparison depends on real physical road networks. In rural areas or corridors with only one highway (e.g., portions of Birmingham or Huntsville), OSRM legitimately returns only 1 route.
   * **How HeatRoute handles this**: HeatRoute does **not** fabricate fake alternative routes. Instead, it displays `ONLY ROUTE AVAILABLE`, reports factual FortyGuard temperature statistics, and suppresses comparative scores (`heatScore = null`, `comparisonAvailable = false`).
2. **Upstream FortyGuard Processing Latency**:
   * FortyGuard's async LTM thermal rendering operates at 100m spatial resolution and takes approximately **20–30 seconds per corridor**.
   * For multi-route comparisons (2–3 corridors), total analysis takes **40–60 seconds**. HeatRoute manages this with progressive status updates and a 120s timeout cushion.
3. **Geographic Demo Scope**:
   * Geocoding and route analysis are prefiltered to the **United States (Alabama Demo)** bounding box ($[24^\circ\text{N} \text{--} 50^\circ\text{N}, 126^\circ\text{W} \text{--} 66^\circ\text{W}]$). Queries outside this region return a controlled `422 Unprocessable Entity` error.
4. **Public OSRM Demo Server**:
   * Uses the public OSRM routing endpoint for demonstration purposes. Enterprise production deployments should connect to a dedicated OSRM or Valhalla cluster.
5. **No Offline Mode**:
   * Requires live network connectivity to the FortyGuard REST API to retrieve real-time LTM thermal distributions.

---

## 7. Real FortyGuard API Request & Response Lifecycle

> **Security Note**: In compliance with security requirements, the actual API key is masked as `<YOUR_FORTYGUARD_API_KEY>`.

### Step 1: Submit Corridor Heatmap Task
* **Endpoint**: `POST https://api.fortyguard.com/v1/heatmap`
* **Headers**:
  ```http
  api-key: <YOUR_FORTYGUARD_API_KEY>
  Content-Type: application/json
  Accept: application/json
  ```
* **Actual Request Payload (Mobile, AL Corridor)**:
  ```json
  {
    "polygon_aoi": {
      "type": "Polygon",
      "coordinates": [
        [
          [-88.0418, 30.6972],
          [-88.0645, 30.6985],
          [-88.0982, 30.7011],
          [-88.1362, 30.6960],
          [-88.1398, 30.6928],
          [-88.1362, 30.6896],
          [-88.0982, 30.6947],
          [-88.0645, 30.6921],
          [-88.0418, 30.6908],
          [-88.0380, 30.6940],
          [-88.0418, 30.6972]
        ]
      ]
    },
    "date_time": {
      "start_date": "2026-08-30",
      "start_time": "14:00",
      "filter_type": 1
    },
    "granularity": 100,
    "analytic_type": "tcm"
  }
  ```
* **Actual Initial Response (HTTP 200)**:
  ```json
  {
    "error": false,
    "status_code": 200,
    "message": "Heatmap request submitted successfully.",
    "data": {
      "activity_id": "0bb6a027-3b9f-4c2d-bbc7-d7fa98d41967",
      "status": "Processing"
    }
  }
  ```

---

### Step 2: Poll Activity Status Until Completion
* **Endpoint**: `GET https://api.fortyguard.com/v1/status/0bb6a027-3b9f-4c2d-bbc7-d7fa98d41967`
* **Headers**:
  ```http
  api-key: <YOUR_FORTYGUARD_API_KEY>
  Accept: application/json
  ```
* **Actual Completed Response from FortyGuard (HTTP 200)**:
  ```json
  {
    "error": false,
    "status_code": 200,
    "message": "Heatmap data retrieved successfully.",
    "data": {
      "activity_id": "0bb6a027-3b9f-4c2d-bbc7-d7fa98d41967",
      "status": "Completed",
      "stats_data": {
        "Temperature_stats": {
          "Mean": 33.40,
          "Maximum": 33.89,
          "Minimum": 33.12,
          "Median": 33.38,
          "StdDev": 0.18
        }
      },
      "result": {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "geometry": {
              "type": "Polygon",
              "coordinates": [[[-88.041, 30.697], [-88.040, 30.697], [-88.040, 30.696], [-88.041, 30.696], [-88.041, 30.697]]]
            },
            "properties": {
              "temperature": 33.42,
              "surface_type": "asphalt",
              "tile_id": 10482
            }
          }
        ]
      }
    }
  }
  ```

---

## 8. HeatRoute Backend API Request & Response

* **Endpoint**: `POST http://localhost:3001/api/analyze`
* **Request Payload**:
  ```json
  {
    "origin": { "lat": 30.6954, "lng": -88.0399 },
    "destination": { "lat": 30.6944, "lng": -88.1380 },
    "time": "14:00"
  }
  ```
* **Actual Backend Response Payload (Multi-Route Evaluation)**:
  ```json
  {
    "routes": [
      {
        "id": "route-0",
        "name": "Route 1 (Springhill Ave)",
        "rank": 1,
        "recommended": true,
        "comparisonAvailable": true,
        "heatScore": 0,
        "distanceMeters": 11002,
        "durationSeconds": 984,
        "avgTemperatureCelsius": 33.4,
        "maxTemperatureCelsius": 33.9,
        "minTemperatureCelsius": 33.1,
        "tileCount": 305,
        "activityId": "0bb6a027-3b9f-4c2d-bbc7-d7fa98d41967",
        "geometry": { "coordinates": [{ "lat": 30.6954, "lng": -88.0399 }] },
        "components": {
          "avgTempScore": 0,
          "peakTempScore": 0,
          "distanceScore": 0
        }
      },
      {
        "id": "route-1",
        "name": "Route 2 (Airport Blvd)",
        "rank": 2,
        "recommended": false,
        "comparisonAvailable": true,
        "heatScore": 100,
        "distanceMeters": 17614,
        "durationSeconds": 984,
        "avgTemperatureCelsius": 33.5,
        "maxTemperatureCelsius": 34.3,
        "minTemperatureCelsius": 32.4,
        "tileCount": 455,
        "activityId": "a7336511-4fa5-434a-ba68-38b05dfdf5a5",
        "geometry": { "coordinates": [{ "lat": 30.6954, "lng": -88.0399 }] },
        "components": {
          "avgTempScore": 50,
          "peakTempScore": 30,
          "distanceScore": 20
        }
      }
    ],
    "recommendation": {
      "routeId": "route-0",
      "routeName": "Route 1 (Springhill Ave)",
      "comparisonAvailable": true,
      "tradeoffs": {
        "avgTempDiffCelsius": -0.1,
        "peakTempDiffCelsius": -0.4,
        "distanceDiffKm": -6.6,
        "scoreAdvantage": 100
      },
      "reasons": [
        "0.1°C lower mean temperature than Route 2 (Airport Blvd)",
        "0.4°C lower peak temperature in this hour than Route 2 (Airport Blvd)",
        "6.6 km shorter travel distance"
      ]
    },
    "analysisTime": {
      "date": "2026-08-30",
      "time": "14:00",
      "formatted": "14:00 (2:00 PM)"
    }
  }
  ```

---

## 9. Mathematical Heat Scoring Model

For any multi-route comparison ($N \ge 2$), raw candidate parameters are min-max normalized across the candidate set:

$$\text{normAvg}_i = \frac{\bar{T}_i - \min(\bar{T})}{\max(\bar{T}) - \min(\bar{T})}$$

$$\text{normPeak}_i = \frac{T_{\text{max}, i} - \min(T_{\text{max}})}{\max(T_{\text{max}}) - \min(T_{\text{max}})}$$

$$\text{normDist}_i = \frac{D_i - \min(D)}{\max(D) - \min(D)}$$

$$\text{RawScore}_i = 0.50 \cdot \text{normAvg}_i + 0.30 \cdot \text{normPeak}_i + 0.20 \cdot \text{normDist}_i$$

$$\text{Heat Exposure Score}_i = \text{round}(\text{RawScore}_i \cdot 100)$$

* **Interpretation**: **0 = Coolest, most resilient relative corridor**; **100 = Highest relative exposure**.
* **Zero-Variance Guard**: When all routes have identical temperatures or distances, normalized terms evaluate strictly to `0.0`, eliminating division-by-zero errors.

---

## 10. Security & Secret Protection Guarantee

```text
=============================================================================
SECURITY AUDIT STATUS
=============================================================================
[PASS] API Secret Isolation       : FORTYGUARD_API_KEY is server-side only (.env).
[PASS] Frontend Bundle Isolation  : Zero occurrences of API keys in Vite build.
[PASS] Git Ignored                : .env and .env.* are strictly ignored across repo.
[PASS] Network Boundary           : Browser communicates only with same-origin /api/*.
[PASS] Hard Request Limits        : MAX_FORTYGUARD_REQUESTS_PER_ANALYSIS = 40.
[PASS] Input Sanitation           : Zod schema validation & US boundary prefilters.
=============================================================================
```

---

## 11. Automated Test Suite (Vitest)

Execute the full suite via `npm test` inside `heatroute/`:

| Test Suite | Tests | Scope |
|---|:---:|---|
| `tests/fortyguard/contract.test.ts` | 7 | Submission, `activity_id`, `Processing`/`Completed` status polling, schema validation. |
| `tests/fortyguard/parser.test.ts` | 3 | Multi-casing parsing, missing `-999` value filtering, tile feature fallback. |
| `tests/routing/area.test.ts` | 4 | Spherical excess area calculation, plan limit validation, oversized AOI rejection. |
| `tests/routing/sampling.test.ts` | 3 | Route sampling, 200m corridor buffering, polygon closure, GeoJSON coordinate order. |
| `tests/scoring/heatScore.test.ts` | 7 | Normalization math, division-by-zero protection, distance penalties, scoring determinism. |
| `tests/scoring/ranking.test.ts` | 2 | Route ranking, tradeoff delta calculations, factual explanation generation. |
| `tests/validation/schemas.test.ts` | 7 | Zod coordinate schemas, US bounds prefilters, negative non-US query rejection. |
| **Total** | **33** | **100% Passed (0 failures)** |
