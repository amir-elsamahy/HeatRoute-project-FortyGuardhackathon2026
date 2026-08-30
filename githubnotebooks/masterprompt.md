# HEATROUTE — FINAL BUILD MASTER PROMPT

## FortyGuard Hackathon'26

You are responsible for building the complete **HeatRoute** hackathon project from the current workspace.

This is a fresh implementation directive.

Do not blindly follow assumptions from an earlier implementation.

The goal is to produce the **simplest clean, secure, reliable, polished, working application possible within a hackathon timeframe**.

The application must use the real FortyGuard API and must not rely on fake production data.

---

# 1. PROJECT

## Name

HeatRoute

## Core concept

HeatRoute answers:

> **Which route between two locations has lower heat exposure, rather than simply choosing the shortest route?**

The application combines:

```text
User locations
      ↓
Real road routes
      ↓
Candidate route alternatives
      ↓
Route sampling / geographic analysis
      ↓
FortyGuard temperature intelligence
      ↓
Heat Exposure Score
      ↓
Route comparison
      ↓
Recommendation
```

The product should feel like a real climate-tech mobility product, not a generic dashboard.

---

# 2. HACKATHON CONTEXT

This project is being built for:

**FortyGuard Hackathon'26**

The official event focuses on applications powered by the FortyGuard Temperature API and currently lists these tracks:

* Resilient Cities & Infrastructure
* Future Buildings & Energy
* Industrial & Enterprise
* Government & Environment

HeatRoute primarily fits:

**Resilient Cities & Infrastructure**

and may also naturally overlap with:

**Government & Environment**

Do not force additional tracks into the product.

The core product should remain focused on heat-aware routing.

---

# 3. SOURCE-OF-TRUTH HIERARCHY

Use the following sources in this exact priority order.

### Priority 1 — Official FortyGuard documentation supplied by the user

The user has provided the official FortyGuard API documentation/content in the project resources and/or `setup.md`.

Use that as the authoritative source for:

* endpoints
* authentication
* request schemas
* response schemas
* activity/status workflow
* supported values
* limits
* geographic restrictions
* API behavior

### Priority 2 — The FortyGuard notebooks supplied by the user

Use the notebooks as implementation examples.

Cross-check them against the official documentation.

### Priority 3 — `setup.md`

Use it as the project's collected FortyGuard research/reference material.

### Priority 4 — `masterprompt.md`

Use it for project/product requirements that are not dictated by the API documentation.

### Priority 5 — Your engineering judgment

Use engineering judgment only when the above sources do not determine a decision.

Never override verified API behavior with assumptions.

---

# 4. DO NOT SCRAPE THE DOCUMENTATION WEBSITE

Do NOT waste time trying to scrape or repeatedly navigate the FortyGuard documentation website.

The user has already supplied:

* the API documentation information
* notebooks
* setup information
* implementation instructions

Read those materials directly.

If the documentation content supplied in the workspace already contains the information needed, use it.

Only use the official web documentation as a verification source when the necessary information is genuinely missing from the supplied materials and you have a reliable way to access it.

Do not spend excessive time fighting an SPA documentation interface.

---

# 5. FIRST STEP — INSPECT EVERYTHING

Before writing significant code:

Read:

```text
setup.md
masterprompt.md
```

Read every relevant supplied notebook/documentation resource.

Inspect the current workspace.

Determine:

* what project files currently exist
* what code already exists
* what can be reused
* what is incorrect
* whether an existing implementation should be replaced

Do not preserve broken architecture merely because it already exists.

Do not destroy working code merely for stylistic reasons.

Make the simplest technically correct decision.

---

# 6. API CREDENTIAL

The FortyGuard API credential is already stored in the project's environment configuration.

It may be in:

```text
.env
```

or:

```text
.env.local
```

Use the existing environment configuration.

NEVER:

* ask the user to paste the key into source code
* put the key in React code
* put the key in a public environment variable
* put the key in README files
* put the key in setup files
* print the key
* log the key
* put the key in URLs
* return the key to the frontend
* commit the key to git

If an environment variable is already present, use it.

If necessary, create/update `.env.example` using the variable NAME only.

Never copy the real secret into `.env.example`.

---

# 7. GEOGRAPHIC SCOPE — CRITICAL

The current FortyGuard API documentation states that API requests currently support locations within the **United States**.

The credential supplied for this project is intended to be used with **Alabama, USA**.

Therefore the actual HeatRoute demonstration MUST use supported US/Alabama locations.

Do NOT build the real demo around:

* Dubai
* UAE
* Cairo
* Europe
* Asia
* arbitrary worldwide locations

Do not hardcode Dubai as a demo.

Do not use Dubai coordinates in the real application.

If an old implementation contains Dubai/UAE examples, remove or replace them with appropriate Alabama examples.

The application MUST NOT fabricate FortyGuard results for unsupported locations.

If the application permits a user to enter a location outside the supported area, handle that situation gracefully before attempting an unsupported FortyGuard request where practical.

At minimum, the application must never silently show fake heat results.

---

# 8. API KNOWLEDGE THAT MUST BE VERIFIED

Before implementing the FortyGuard adapter, verify the supplied documentation/materials for:

```text
Base URL
Authentication
API key header
Heatmap endpoint
HTTP method
Request structure
GeoJSON structure
Date/time structure
Filter types
Granularity
Analytic type
Threshold behavior
Activity ID
Status endpoint
Status values
Completed result
Failed result
Map data
Statistics data
Area limitations
Coordinate format
Geographic limitations
Request limitations
```

Do not invent any missing value.

The currently documented heatmap API is conceptually:

```text
POST /v1/heatmap
        ↓
activity_id
        ↓
GET /v1/status/{activity_id}
        ↓
Completed
        ↓
map_data + stats_data
```

Verify this against the supplied documentation before implementation.

---

# 9. STACK — KEEP IT LIGHT

Use:

## Frontend

**Vite + React + TypeScript**

not Next.js.

## Styling

**Tailwind CSS**

Use the simplest setup compatible with the project.

## Mapping

Use one lightweight mapping library:

**Leaflet**

unless the supplied workspace already has a better working map implementation.

## Backend

Use the smallest secure server layer necessary to protect the FortyGuard secret.

Preferred approach:

```text
Vite React frontend
        ↓
small Node/TypeScript server
        ↓
FortyGuard
```

Use Express or another minimal server only if needed.

Do NOT add a large backend framework.

## Validation

Use:

**Zod**

for server/API input validation.

## Tests

Use:

**Vitest**

for unit/integration tests.

## Routing

Use:

**OSRM**

or another lightweight legitimate routing service if the supplied environment already contains a suitable solution.

Prefer OSRM for simplicity.

## Geocoding

Use **Nominatim** only if needed.

Keep external services minimal.

---

# 10. WHY THIS STACK

The implementation should remain simple:

```text
React
   ↓
TypeScript
   ↓
small server
   ↓
FortyGuard
```

No Next.js-specific architecture.

No SSR unless genuinely necessary.

No database.

No authentication system.

No microservices.

No queues.

No Kubernetes.

No Redis.

No vector database.

No unnecessary AI agent framework.

No unnecessary state-management framework.

No complex cloud infrastructure.

This is a hackathon MVP.

---

# 11. PROJECT STRUCTURE

You are responsible for creating the final structure.

Use something approximately like:

```text
heatroute/
│
├── src/
│   ├── components/
│   │   ├── Map/
│   │   ├── LocationSearch/
│   │   ├── RouteCard/
│   │   ├── RouteComparison/
│   │   ├── HeatScore/
│   │   └── ui/
│   │
│   ├── services/
│   │   ├── api.ts
│   │   └── geocoding.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── styles/
│
├── server/
│   ├── index.ts
│   ├── routes/
│   │   ├── analyze.ts
│   │   └── geocode.ts
│   │
│   ├── services/
│   │   ├── fortyguard/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   ├── schemas.ts
│   │   │   ├── parser.ts
│   │   │   └── errors.ts
│   │   │
│   │   ├── routing/
│   │   │   ├── osrm.ts
│   │   │   └── sampling.ts
│   │   │
│   │   └── scoring/
│   │       ├── heatScore.ts
│   │       └── ranking.ts
│   │
│   └── config.ts
│
├── tests/
│
├── public/
├── setup.md
├── masterprompt.md
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

You may improve this structure if there is a clear reason.

Do not create unnecessary folders or abstractions.

---

# 12. IMPORTANT — SERVER/FONTEND BOUNDARY

The browser must NEVER communicate with FortyGuard directly using the secret API key.

Correct:

```text
Browser
   ↓
HeatRoute server
   ↓
FortyGuard
```

Incorrect:

```text
Browser
   ↓
FortyGuard + secret
```

The server owns:

* FortyGuard authentication
* FortyGuard HTTP requests
* polling
* response validation
* API error handling
* retry/timeout policy

The frontend receives only the normalized data it needs.

---

# 13. FORTYGUARD ADAPTER

Create one isolated FortyGuard service.

Example:

```text
server/services/fortyguard/client.ts
```

It should be responsible for:

```text
authentication
request creation
POST /v1/heatmap
activity_id extraction
status polling
result retrieval
timeout
bounded retry
error handling
response validation
normalization
```

Do not scatter FortyGuard API calls throughout the project.

---

# 14. API REQUEST FLOW

Implement the actual documented FortyGuard workflow.

Conceptually:

```text
POST /v1/heatmap
       ↓
activity_id
       ↓
poll GET /v1/status/{activity_id}
       ↓
Processing
       ↓
continue
       ↓
Completed
       ↓
read result
```

Use actual status values from the supplied official documentation.

Do not hardcode undocumented statuses.

Use a bounded polling loop.

Never poll forever.

Never retry forever.

---

# 15. FORTYGUARD REQUEST DATA

Use real values.

The heatmap request must be based on:

* actual route/corridor geometry
* actual supported date/time
* documented `filter_type`
* documented `granularity`
* documented `analytic_type`

Choose the simplest appropriate documented configuration.

Do not send unnecessary parameters.

Do not use undocumented parameters.

---

# 16. DATE/TIME

Respect the documented FortyGuard date/time constraints.

Use valid current/historical values supported by the API.

For the simplest implementation:

Use a single-hour/current or otherwise appropriate documented heatmap request unless the supplied materials provide a better route-analysis configuration.

Do not create a complicated forecasting system.

Make the chosen time visible to the user where appropriate.

---

# 17. ROUTING

The application needs genuine road routes.

Do NOT use:

* straight lines
* fake coordinates
* hand-authored route geometry
* duplicate routes masquerading as alternatives

Use a real routing service.

The target flow is:

```text
Start
 ↓
Destination
 ↓
routing service
 ↓
candidate road routes
```

Use a small number of candidate routes.

Approximately 2–3 is enough.

Do not generate huge numbers of alternatives.

---

# 18. ALTERNATIVE ROUTES

Verify that the routing service actually returns different alternatives.

Do not assume an API parameter guarantees alternatives.

If fewer alternatives are returned, gracefully work with the routes actually available.

Do not fabricate alternatives.

---

# 19. GEOCODING

If the user enters text locations, convert them into real coordinates using a legitimate geocoding service.

Geocoding must happen server-side when appropriate.

Do not allow arbitrary user URLs to be fetched.

Validate returned coordinates.

Ensure latitude and longitude are not accidentally reversed.

---

# 20. COORDINATE ORDER

This is a critical correctness check.

Verify the coordinate order independently for:

* geocoding provider
* routing provider
* GeoJSON
* FortyGuard

GeoJSON uses:

```text
[longitude, latitude]
```

where applicable.

Do not assume all providers use the same order.

Create explicit conversion utilities where necessary.

Test coordinate conversions.

---

# 21. ROUTE SAMPLING

Do not send every route vertex to FortyGuard.

Instead:

```text
route geometry
      ↓
sample representative points
      ↓
construct analysis corridor
      ↓
FortyGuard heatmap
```

Keep request volume low.

Choose a reasonable deterministic sampling method.

The exact implementation should be based on route length and API limits.

---

# 22. ROUTE CORRIDOR

If using a polygon around the route:

```text
route
 ↓
buffer
 ↓
GeoJSON Polygon
 ↓
FortyGuard
```

The polygon MUST be:

* valid GeoJSON
* closed
* correctly oriented/structured according to GeoJSON requirements
* within FortyGuard's documented area limits

Do not create an enormous corridor.

Do not blindly buffer long routes into oversized polygons.

---

# 23. AREA LIMIT PROTECTION

The FortyGuard documentation specifies heatmap area limits that vary by subscription plan.

Determine the user's actual plan/limit from the supplied material where possible.

Build safeguards so a route analysis cannot blindly submit an oversized AOI.

If a route exceeds the supported analysis area:

* reject gracefully,
* reduce the corridor/sample scope if scientifically legitimate,
* or split the analysis only if that is supported and correctly implemented.

Do NOT invent an unsupported workaround.

Never knowingly send an oversized polygon.

---

# 24. HEAT DATA

Use actual FortyGuard heatmap results.

Use documented result fields such as:

```text
stats_data
temperature statistics
mean
maximum
minimum
etc.
```

Use the exact actual field names defined by the API/schema.

Do not invent values.

Do not use mock values in production.

---

# 25. HEAT EXPOSURE SCORE

Create a simple deterministic comparative metric.

Name it:

**Heat Exposure Score**

It is a HeatRoute-derived comparison metric.

It is NOT an official FortyGuard safety score unless the official documentation says so.

A reasonable concept is:

```text
heat exposure
+
peak heat
+
route distance
=
comparative route score
```

Use a transparent formula.

The formula should be:

* deterministic
* explainable
* documented
* unit-tested

Do not use machine learning.

Do not pretend the score is scientifically certified.

---

# 26. SCORE NORMALIZATION

If using normalized values, define exactly how normalization works.

For example:

```text
normalized value =
(value - minimum) /
(maximum - minimum)
```

Handle the case where:

```text
maximum == minimum
```

without division by zero.

Do not silently use fake fallback values.

Make the score clearly comparative between candidate routes.

Do not display wording such as:

> 20/100 = medically safe

Instead use:

> Lower heat exposure compared with the other evaluated routes.

---

# 27. ROUTE DISTANCE

Distance must come from the actual routing provider.

Do not generate distance manually unless deriving it from verified route geometry using a legitimate deterministic calculation.

Do not fabricate travel times.

---

# 28. RECOMMENDATION

The final result should clearly answer:

> **Which route should I choose?**

Example:

```text
RECOMMENDED

Route B

Heat Exposure Score
34

Average Heat
36.8°C

Peak Heat
39.7°C

Distance
4.8 km

Why:
Lower heat exposure than the alternatives,
with only a small distance increase.
```

These values MUST be real or mathematically derived from real data.

---

# 29. RECOMMENDATION EXPLANATION

Generate the explanation deterministically.

Do not use an LLM for this.

For example:

```text
Route B is recommended because:

• lower mean temperature
• lower peak temperature
• acceptable additional distance
```

Only mention factors that actually contributed to the ranking.

---

# 30. NO GENERIC CHATBOT

Do NOT add:

* ChatGPT chat UI
* "Ask AI"
* generic chatbot
* LLM wrapper

unless the project requirements later explicitly require it.

The intelligent part is the route-analysis engine.

---

# 31. UI

Build a polished but simple interface.

The first screen should immediately communicate:

> **Find a route with less heat exposure.**

Main flow:

```text
Start
Destination
Analyze
↓
Map
↓
Route alternatives
↓
Heat comparison
↓
Recommended route
```

---

# 32. UI DESIGN

Visual direction:

**Premium climate-tech / mobility intelligence**

Use:

* clean typography
* strong visual hierarchy
* restrained styling
* clear map
* clean route cards
* responsive layout
* subtle animations only where useful

Do not clutter the interface.

The map should be the visual centerpiece.

---

# 33. MAP

Show:

* start marker
* destination marker
* candidate routes
* recommended route prominently

Optionally show sampled heat points/heat information when useful.

Do not place hundreds of markers on the map.

Do not let visualization overwhelm the route comparison.

---

# 34. LOADING

The user must clearly know the app is working.

Example:

```text
Finding routes...
Analyzing heat conditions...
Comparing route exposure...
Preparing recommendation...
```

Do not fake exact progress percentages.

Only display meaningful states.

---

# 35. ERRORS

Create clean user-facing errors.

Examples:

```text
We couldn't find a route between those locations.

FortyGuard heat intelligence is temporarily unavailable.

This location is outside the currently supported FortyGuard region.

The selected route is too large for the available heatmap area.

Please try again.
```

Never expose:

* stack traces
* API keys
* internal paths
* raw authentication errors
* raw server internals

---

# 36. SECURITY

Implement practical security.

## Secrets

Server only.

## Validation

Validate:

* coordinates
* strings
* route request
* all API inputs

## SSRF

Never allow arbitrary URLs from users to be fetched server-side.

## Injection

Do not render unsafe HTML.

## API abuse

Protect against:

* duplicate rapid submissions
* infinite polling
* infinite retries
* huge payloads
* unreasonable route sizes

## Errors

Return controlled errors.

## Headers

Add sensible security headers compatible with the lightweight architecture.

At minimum consider:

```text
X-Content-Type-Options
X-Frame-Options
Referrer-Policy
```

Add CSP only if it can be done without breaking the map/application.

---

# 37. CORS

Use same-origin architecture where possible.

Do not introduce broad:

```text
Access-Control-Allow-Origin: *
```

unless genuinely necessary.

---

# 38. RATE CONTROL

Create reasonable application-level protections.

For example:

* one active analysis per client/session where practical
* disable repeated submit while analysis is running
* bounded requests
* bounded polling
* bounded retries

Do not create an overly complicated distributed rate-limiter.

---

# 39. TIMEOUTS

External requests must have bounded timeouts.

This includes:

* geocoding
* routing
* FortyGuard submission
* FortyGuard status requests

Never allow an external request to hang forever.

---

# 40. ABORT / STALE REQUEST HANDLING

Handle cases where the user starts another analysis before the previous one has finished.

Prevent stale results from overwriting newer results.

---

# 41. NO DATABASE

Do not add a database.

There is no need for:

* accounts
* saved searches
* user profiles
* persistence

unless explicitly required later.

---

# 42. NO AUTHENTICATION

Do not build a login system.

It adds unnecessary complexity to this hackathon MVP.

---

# 43. NO FAKE DATA

Production mode MUST use real data.

Never hardcode:

```text
Dubai route
fake temperature
fake heat score
fake route geometry
fake FortyGuard response
fake recommendation
```

Test fixtures may exist, but they must be clearly isolated.

Production must not silently fall back to fixtures.

---

# 44. TEST FIXTURES

For automated tests, use deterministic fixtures.

For example:

```text
tests/fixtures/
```

These must never be returned by production API paths.

Do not confuse test fixtures with live API results.

---

# 45. TYPESCRIPT

Use strict TypeScript.

Avoid unnecessary `any`.

Create explicit types for:

```text
route
coordinates
heat observations
FortyGuard responses
normalized statistics
scores
recommendations
API errors
```

---

# 46. RESPONSE NORMALIZATION

Do not spread raw FortyGuard API response fields through the frontend.

Use:

```text
FortyGuard raw response
        ↓
parser
        ↓
HeatObservation / AnalysisResult
        ↓
frontend
```

This keeps the API integration isolated.

---

# 47. API ERROR MODEL

Create typed application errors for cases such as:

```text
InvalidInput
UnsupportedRegion
FortyGuardAuthenticationError
FortyGuardRateLimit
FortyGuardValidationError
FortyGuardProcessingError
FortyGuardTimeout
RoutingError
GeocodingError
```

Use only categories that are actually useful.

---

# 48. CACHING

Do not build complicated caching.

A small in-memory cache may be used if it genuinely reduces duplicate API calls and is safe for the chosen deployment model.

Do not rely on it for correctness.

---

# 49. PERFORMANCE

Keep the analysis cheap.

Do not:

* query every route vertex
* request enormous heatmaps
* poll aggressively
* send redundant requests

Minimize FortyGuard usage while retaining useful route comparison.

---

# 50. REAL API VERIFICATION

Before considering the integration complete:

Use the real credential from the environment.

Run a minimal valid request using an actual supported Alabama location.

Verify:

```text
authentication
↓
POST /v1/heatmap
↓
activity_id
↓
status polling
↓
Completed
↓
result
↓
parser
↓
normalized data
```

Do not reveal the secret.

Record only non-sensitive verification information.

---

# 51. REAL END-TO-END VERIFICATION

Then test:

```text
Alabama start
↓
Alabama destination
↓
geocoding
↓
OSRM
↓
candidate routes
↓
route corridor
↓
FortyGuard
↓
heat statistics
↓
score
↓
ranking
↓
recommendation
↓
browser UI
```

This is the test that determines whether HeatRoute actually works.

---

# 52. UNSUPPORTED LOCATION TEST

Test an unsupported non-US location.

For example:

```text
Dubai, UAE
```

The test is NOT to use it as a normal project example.

The purpose is to verify that the application does NOT accidentally send unsupported coordinates to FortyGuard and fabricate a result.

The expected behavior should be a controlled unsupported-region response or equivalent safe handling.

Do not show fake heat data.

---

# 53. SEARCH FOR LEFTOVER BAD DATA

Search the repository for:

```text
Dubai
UAE
United Arab Emirates
25.2048
55.2708
```

and suspicious hardcoded:

* temperature values
* scores
* route coordinates
* route geometry
* demo heat data

Classify each occurrence as:

* legitimate test
* documentation
* configuration
* hardcoded production data

Remove inappropriate production examples.

Use Alabama examples for the real demo.

---

# 54. TESTING REQUIREMENTS

Create tests for:

## Validation

* valid coordinates
* invalid coordinates
* unsupported coordinates
* missing fields

## Coordinate conversion

* lat/lon
* GeoJSON lon/lat
* provider conversions

## Route sampling

* deterministic sampling
* short routes
* long routes
* valid coordinates

## Polygon

* closed polygon
* valid GeoJSON
* sensible area

## Heat score

* deterministic result
* lower heat improves ranking
* peak heat matters
* distance matters
* identical values handled correctly
* no division-by-zero

## Ranking

* correct recommendation
* deterministic ties

## FortyGuard adapter

* successful submission
* activity ID
* processing
* completed
* failed
* timeout
* malformed response
* API error

---

# 55. BUILD AND CHECKS

Create appropriate npm scripts and run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If a script doesn't exist, add it.

Do not claim PASS unless it actually passed.

---

# 56. BROWSER QA

Run the actual application.

Test:

### Desktop

* location inputs
* analyze button
* map
* routes
* scores
* recommendation
* loading
* errors

### Mobile

* responsive layout
* map
* route cards
* buttons
* no horizontal overflow

Inspect browser console.

Fix:

* runtime errors
* hydration problems if any
* broken map
* failed API calls
* layout issues
* stale state
* loading problems

---

# 57. README

Create/update a professional README.

Include:

## What is HeatRoute?

## Problem

## Solution

## Why FortyGuard?

## How it works

```text
Locations
→ Routing
→ Route sampling
→ FortyGuard
→ Heat statistics
→ Heat Exposure Score
→ Route ranking
```

## Architecture

Use a Mermaid diagram.

## Tech stack

Explain WHY each technology exists.

## FortyGuard integration

Explain:

* server-side authentication
* heatmap submission
* activity ID
* status polling
* result processing

## Security

Explain:

* secrets
* validation
* timeouts
* retries
* request protection

## Local setup

## Environment variables

## Testing

## Known limitations

Make the current geographic support honest.

Do not claim worldwide FortyGuard coverage.

---

# 58. API DOCUMENTATION LINK

Include the official FortyGuard documentation link supplied by the user in the README.

Do not claim undocumented capabilities.

---

# 59. FINAL CODE QUALITY PASS

Before finishing:

Remove:

* dead code
* unused imports
* debug statements
* placeholder text
* fake production data
* unnecessary dependencies
* unnecessary abstractions
* duplicate implementations

Keep the codebase understandable.

---

# 60. FINAL SECURITY AUDIT

Inspect the complete project for:

```text
[ ] FortyGuard secret exposed
[ ] secret in frontend bundle
[ ] secret in git
[ ] secret in logs
[ ] arbitrary server-side URL fetching
[ ] missing input validation
[ ] unsafe HTML
[ ] infinite polling
[ ] infinite retries
[ ] excessive API requests
[ ] raw internal errors exposed
[ ] unsupported geography silently analyzed
[ ] fake production data
[ ] insecure CORS
```

Fix all issues found.

---

# 61. FINAL PRODUCT AUDIT

Ask:

### Can a judge understand the product immediately?

### Does it solve an obvious problem?

### Does FortyGuard materially power the product?

### Are the results derived from real data?

### Is the API secret protected?

### Does an actual Alabama analysis work?

### Does route comparison work?

### Does the recommendation have a clear reason?

### Does the UI look polished?

### Is the architecture simple enough to explain in one minute?

### Can the project be run locally without special infrastructure?

If any answer is no, fix the problem before completion.

---

# 62. DO NOT OVERBUILD

The following are specifically prohibited unless genuinely required:

* Next.js
* database
* authentication
* generic chatbot
* LLM agent framework
* MCP
* vector database
* Redis
* Docker complexity solely for appearance
* microservices
* Kubernetes
* unnecessary cloud services
* complicated state management
* unnecessary analytics
* unnecessary admin panel

The objective is:

**small, fast, secure, polished, real.**

---

# 63. IMPLEMENTATION ORDER

Use this order:

```text
1. Read setup.md
2. Read masterprompt.md
3. Inspect notebooks/resources
4. Inspect current workspace
5. Verify environment
6. Verify FortyGuard API understanding
7. Verify one real Alabama API request
8. Build lightweight Vite + React + TypeScript architecture
9. Build minimal server
10. Build FortyGuard adapter
11. Build routing
12. Build geocoding
13. Build route sampling
14. Build corridor generation
15. Build scoring
16. Build ranking
17. Build frontend
18. Build map
19. Build loading/errors
20. Build tests
21. Run real end-to-end analysis
22. Run lint/typecheck/tests/build
23. Browser QA
24. Security audit
25. Remove leftovers
26. Update README
27. Final verification
```

---

# 64. AUTONOMY

You are responsible for all implementation decisions that can reasonably be determined from the supplied material.

Do not ask the user to:

* create folders
* name files
* design components
* write API clients
* configure the server
* implement tests
* decide the scoring architecture
* move secrets
* manually fix TypeScript
* manually fix UI issues

Build it yourself.

Only stop and ask the user if something is genuinely impossible to determine from the available resources.

---

# 65. IMPORTANT — DON'T CLAIM SUCCESS TOO EARLY

Do NOT say:

> "The app is complete"

because files were generated.

Completion requires actual verification.

The project is complete only when:

* code exists
* real API integration works
* Alabama test works
* route analysis works
* UI works
* tests pass
* build passes
* security review passes

---

# 66. FINAL REPORT

At the end, provide a factual final report:

# HeatRoute Final Build Report

## 1. What was built

## 2. Architecture

## 3. Tech stack

## 4. FortyGuard integration

## 5. Geographic scope

## 6. Route-generation approach

## 7. Heat Exposure Score formula

## 8. Security measures

## 9. Tests

```text
Typecheck: PASS/FAIL
Lint: PASS/FAIL
Tests: PASS/FAIL
Build: PASS/FAIL
Real FortyGuard Alabama test: PASS/FAIL
End-to-end test: PASS/FAIL
Browser QA: PASS/FAIL
Security audit: PASS/FAIL
```

## 10. Files created/changed

## 11. Environment variables required

Only variable names. NEVER secret values.

## 12. Known limitations

## 13. Remaining issues

If none:

```text
None identified.
```

## 14. Final verdict

Use exactly one:

```text
✅ READY
⚠️ READY WITH KNOWN LIMITATIONS
❌ NOT READY
```

Only choose ✅ READY when the required functionality was genuinely tested.

---

# 67. FINAL PRINCIPLE

Build the smallest genuinely useful version of:

> **HeatRoute — heat-aware route comparison powered by FortyGuard.**

The product should be:

```text
Real data
+
Real routes
+
Real FortyGuard analysis
+
Simple scoring
+
Clear recommendation
+
Excellent UI
+
Secure API
```

No fake data.

No unnecessary complexity.

No invented API behavior.

No exposed secrets.

No unsupported geography.

No contradictory implementations.

No abandoned TODOs for core functionality.

Build it cleanly from end to end.
