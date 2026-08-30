// server/app.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// server/routes/analyze.ts
import { Router } from "express";

// server/config.ts
var CONFIG = {
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173"
  },
  fortyguard: {
    baseUrl: "https://api.fortyguard.com",
    /** Granularity in meters (60, 80, or 100) */
    granularity: 100,
    /** Filter type: 1 = Single Hour (snapshot for selected hour) */
    filterType: 1,
    /** Analytic type: 'tcm' for temperature snapshot in °C */
    analyticType: "tcm",
    /** Maximum time to wait for asynchronous task completion (ms) */
    maxPollMs: 12e4,
    /** Polling interval (ms) */
    pollIntervalMs: 3e3,
    /** Max polling cycles guard */
    maxPollCycles: 40,
    /** Max retries on transient network errors */
    maxRetries: 2,
    /** Backoff delay base (ms) */
    retryBackoffMs: 1e3,
    /** Request timeout for individual calls (ms) */
    requestTimeoutMs: 3e4,
    /**
     * Maximum supported AOI area in square miles.
     * 10 mi² is the conservative fallback for Basic/Startup plans;
     * 50 mi² is available on Premium plans.
     */
    maxAreaSqMiles: parseFloat(process.env.FORTYGUARD_MAX_AOI_AREA_MI2 || "10"),
    /** Hard budget limits per route analysis to prevent accidental infinite loops/excessive billing */
    budgets: {
      maxCandidateRoutes: 3,
      maxHeatmapSubmissionsPerAnalysis: 3,
      maxStatusPollsPerActivity: 40,
      maxTotalRequestsPerAnalysis: 40
    }
  },
  routing: {
    osrmBaseUrl: "https://router.project-osrm.org",
    profile: "driving",
    maxAlternativeRoutes: 3,
    samplesPerRoute: 6,
    corridorBufferMeters: 200,
    requestTimeoutMs: 15e3
  },
  geocoding: {
    nominatimBaseUrl: "https://nominatim.openstreetmap.org",
    userAgent: "HeatRouteApp/1.0",
    requestTimeoutMs: 1e4,
    countryCodes: "us",
    minQueryLength: 3,
    cacheTtlMs: 36e5
    // 1 hour in-memory cache
  },
  scoring: {
    avgTempWeight: 0.5,
    peakTempWeight: 0.3,
    distanceWeight: 0.2,
    scoreMax: 100
  },
  /**
   * Geographic prefilter bounds for United States.
   * Contiguous US bounding box: Lat [24.0, 50.0], Lng [-126.0, -66.0].
   */
  geo: {
    US_LAT_MIN: 24,
    US_LAT_MAX: 50,
    US_LON_MIN: -126,
    US_LON_MAX: -66,
    defaultDemoCenter: {
      lat: 33.5186,
      lng: -86.8104,
      name: "Birmingham, AL"
    }
  }
};

// server/services/fortyguard/schemas.ts
import { z } from "zod";
var LatLngSchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object") {
      const obj = val;
      const lat = typeof obj.lat === "string" ? parseFloat(obj.lat) : obj.lat;
      const rawLng = obj.lng ?? obj.lon;
      const lng = typeof rawLng === "string" ? parseFloat(rawLng) : rawLng;
      return { lat, lng };
    }
    return val;
  },
  z.object({
    lat: z.number({ error: "Latitude is required and must be numeric." }).min(CONFIG.geo.US_LAT_MIN, `Latitude must be within US bounds (min: ${CONFIG.geo.US_LAT_MIN}\xB0N).`).max(CONFIG.geo.US_LAT_MAX, `Latitude must be within US bounds (max: ${CONFIG.geo.US_LAT_MAX}\xB0N).`),
    lng: z.number({ error: "Longitude is required and must be numeric." }).min(CONFIG.geo.US_LON_MIN, `Longitude must be within US bounds (min: ${CONFIG.geo.US_LON_MIN}\xB0W).`).max(CONFIG.geo.US_LON_MAX, `Longitude must be within US bounds (max: ${CONFIG.geo.US_LON_MAX}\xB0W).`)
  })
);
var AnalyzeRequestSchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object") {
      const obj = val;
      const start = obj.start ?? obj.origin;
      const destination = obj.destination ?? obj.dest ?? obj.end;
      return { ...obj, start, destination };
    }
    return val;
  },
  z.object({
    start: LatLngSchema,
    destination: LatLngSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD.").optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be formatted as HH:MM in 24-hour time.").optional()
  })
);
var GeocodeQuerySchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object") {
      const obj = val;
      const q = obj.q ?? obj.query;
      return { ...obj, q };
    }
    return val;
  },
  z.object({
    q: z.string({ error: 'Search query parameter "q" or "query" is required.' }).min(CONFIG.geocoding.minQueryLength, `Search query must be at least ${CONFIG.geocoding.minQueryLength} characters.`).max(150, "Search query is too long.").trim()
  })
);
var TradeoffSummarySchema = z.object({
  avgTempDiffCelsius: z.number(),
  peakTempDiffCelsius: z.number(),
  distanceDiffKm: z.number(),
  scoreAdvantage: z.number()
});
var RecommendationResultSchema = z.object({
  routeId: z.string().nullable(),
  routeName: z.string().nullable(),
  comparisonAvailable: z.boolean(),
  tradeoffs: TradeoffSummarySchema.nullable(),
  reasons: z.array(z.string())
});
var ScoreComponentsSchema = z.object({
  avgTempScore: z.number(),
  peakTempScore: z.number(),
  distanceScore: z.number()
});
var ScoredRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.number().nullable(),
  recommended: z.boolean(),
  comparisonAvailable: z.boolean(),
  heatScore: z.number().nullable(),
  distanceMeters: z.number(),
  durationSeconds: z.number(),
  avgTemperatureCelsius: z.number(),
  maxTemperatureCelsius: z.number(),
  minTemperatureCelsius: z.number(),
  tileCount: z.number(),
  activityId: z.string(),
  geometry: z.object({
    coordinates: z.array(z.object({ lat: z.number(), lng: z.number() }))
  }),
  components: ScoreComponentsSchema.nullable()
});
var AnalyzeResponseSchema = z.object({
  routes: z.array(ScoredRouteSchema),
  rankedRoutes: z.array(ScoredRouteSchema).optional(),
  ranked_routes: z.array(ScoredRouteSchema).optional(),
  recommendation: RecommendationResultSchema,
  heatStatistics: z.array(z.any()).optional(),
  heat_statistics: z.array(z.any()).optional(),
  analysisTime: z.object({
    date: z.string(),
    time: z.string(),
    formatted: z.string()
  })
});

// server/services/routing/osrm.ts
async function fetchCandidateRoutes(origin, destination) {
  const coordinatesParam = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const profile = CONFIG.routing.profile;
  const url = new URL(
    `${CONFIG.routing.osrmBaseUrl}/route/v1/${profile}/${coordinatesParam}`
  );
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "false");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.routing.requestTimeoutMs);
  let response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": CONFIG.geocoding.userAgent
      }
    });
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`Routing service unreachable: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`OSRM returned HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error("No suitable route could be found between these locations.");
  }
  return data.routes.slice(0, CONFIG.routing.maxAlternativeRoutes).map((r, idx) => ({
    id: `route-${idx}`,
    name: `Route ${idx + 1}`,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    geometry: {
      // Convert GeoJSON [longitude, latitude] into internal { lat, lng }
      coordinates: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
    }
  }));
}

// server/services/routing/area.ts
var EARTH_RADIUS_METERS = 6371e3;
var SQ_METERS_PER_SQ_MILE = 258998811e-2;
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
function calculatePolygonAreaSqMiles(ring) {
  if (ring.length < 3) return 0;
  let totalAngle = 0;
  const n = ring.length;
  for (let i = 0; i < n - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % (n - 1)];
    const lon1 = toRadians(p1[0]);
    const lat1 = toRadians(p1[1]);
    const lon2 = toRadians(p2[0]);
    const lat2 = toRadians(p2[1]);
    totalAngle += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  const areaSqMeters = Math.abs(totalAngle * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS / 4);
  return areaSqMeters / SQ_METERS_PER_SQ_MILE;
}
function validateAoiArea(ring, maxAreaSqMiles = CONFIG.fortyguard.maxAreaSqMiles) {
  const areaSqMiles = calculatePolygonAreaSqMiles(ring);
  return {
    valid: areaSqMiles <= maxAreaSqMiles,
    areaSqMiles,
    limitSqMiles: maxAreaSqMiles
  };
}

// server/services/fortyguard/errors.ts
var FortyGuardError = class extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "FortyGuardError";
  }
  code;
  statusCode;
};
var FortyGuardAuthError = class extends FortyGuardError {
  constructor() {
    super("FortyGuard authentication failed. Please verify FORTYGUARD_API_KEY.", "AUTH_ERROR", 401);
  }
};
var FortyGuardRateLimitError = class extends FortyGuardError {
  constructor() {
    super("FortyGuard rate limit exceeded. Please try again shortly.", "RATE_LIMIT", 429);
  }
};
var FortyGuardBudgetExceededError = class extends FortyGuardError {
  constructor(message) {
    super(message, "BUDGET_EXCEEDED", 429);
  }
};
var UnsupportedRegionError = class extends FortyGuardError {
  constructor(locationName) {
    super(
      locationName ? `Location '${locationName}' is outside the supported United States / Alabama region.` : "The requested location is outside the supported United States / Alabama region.",
      "UNSUPPORTED_REGION",
      422
    );
  }
};
var FortyGuardTaskTimeoutError = class extends FortyGuardError {
  constructor(activityId) {
    super(`FortyGuard activity '${activityId}' timed out before completion.`, "TASK_TIMEOUT", 504);
  }
};
var FortyGuardTaskFailedError = class extends FortyGuardError {
  constructor(activityId) {
    super(`FortyGuard activity '${activityId}' processing failed on the server.`, "TASK_FAILED", 502);
  }
};
function toUserFacingMessage(err) {
  if (err instanceof UnsupportedRegionError) {
    return err.message;
  }
  if (err instanceof FortyGuardBudgetExceededError) {
    return "Analysis request budget limit reached. Please wait a moment and try again.";
  }
  if (err instanceof FortyGuardAuthError) {
    return "Thermal intelligence service is not configured correctly on the server.";
  }
  if (err instanceof FortyGuardRateLimitError) {
    return "Too many heat analysis requests were submitted. Please wait a moment and retry.";
  }
  if (err instanceof FortyGuardTaskTimeoutError) {
    return "Heat analysis timed out. Please try again or select a slightly shorter route.";
  }
  if (err instanceof FortyGuardTaskFailedError) {
    return "Heat intelligence analysis could not be completed for this route corridor.";
  }
  if (err instanceof FortyGuardError) {
    return "We were unable to retrieve heat intelligence for this route at this time.";
  }
  if (err instanceof Error) {
    if (err.message.includes("No suitable route")) {
      return "No suitable road route could be found between the chosen locations.";
    }
  }
  return "An unexpected error occurred during route heat analysis. Please try again.";
}

// server/services/routing/sampling.ts
var METERS_PER_DEGREE_LAT = 111132.954;
function sampleRoutePoints(geometry, maxPoints = CONFIG.routing.samplesPerRoute) {
  const coords = geometry.coordinates;
  if (!coords || coords.length === 0) return [];
  if (coords.length <= maxPoints) return [...coords];
  const sampled = [];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), coords.length - 1);
    sampled.push(coords[idx]);
  }
  return sampled;
}
function offsetPoint(p1, p2, bufferMeters, side) {
  const dx = (p2.lng - p1.lng) * Math.cos((p1.lat + p2.lat) / 2 * (Math.PI / 180));
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sign = side === "left" ? 1 : -1;
  const latOffset = sign * ny * bufferMeters / METERS_PER_DEGREE_LAT;
  const lngOffset = sign * nx * bufferMeters / (METERS_PER_DEGREE_LAT * Math.cos(p1.lat * (Math.PI / 180)));
  return {
    lat: p1.lat + latOffset,
    lng: p1.lng + lngOffset
  };
}
function buildCorridorPolygon(geometry, maxPoints = CONFIG.routing.samplesPerRoute, bufferMeters = CONFIG.routing.corridorBufferMeters) {
  const sampled = sampleRoutePoints(geometry, maxPoints);
  if (sampled.length < 2) {
    throw new Error("Route geometry must have at least 2 points to form a corridor.");
  }
  const leftRing = [];
  const rightRing = [];
  for (let i = 0; i < sampled.length; i++) {
    const curr = sampled[i];
    const next = sampled[i + 1] || sampled[i];
    const prev = sampled[i - 1] || sampled[i];
    const refNext = i === sampled.length - 1 ? curr : next;
    const refPrev = i === 0 ? curr : prev;
    const p1 = i === 0 ? curr : refPrev;
    const p2 = i === sampled.length - 1 ? curr : refNext;
    leftRing.push(offsetPoint(curr, p2 === curr ? p1 : p2, bufferMeters, "left"));
    rightRing.push(offsetPoint(curr, p2 === curr ? p1 : p2, bufferMeters, "right"));
  }
  const fullPolygonPoints = [...leftRing, ...rightRing.reverse()];
  fullPolygonPoints.push(fullPolygonPoints[0]);
  const coordinates = fullPolygonPoints.map((p) => [p.lng, p.lat]);
  const areaCheck = validateAoiArea(coordinates);
  if (!areaCheck.valid) {
    throw new FortyGuardError(
      `Route corridor area (${areaCheck.areaSqMiles.toFixed(1)} sq mi) exceeds the configured FortyGuard AOI limit (${areaCheck.limitSqMiles} sq mi).`,
      "INVALID_REQUEST",
      422
    );
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          areaSqMiles: areaCheck.areaSqMiles
        },
        geometry: {
          type: "Polygon",
          coordinates: [coordinates]
        }
      }
    ]
  };
}
function getDefaultAnalysisDateTime() {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - 1);
  const date = d.toISOString().split("T")[0];
  const time = "14:00";
  return { date, time };
}

// server/services/fortyguard/parser.ts
function extractTemperatureStats(stats) {
  return stats.Temperature_stats ?? stats.temperature_stats ?? null;
}
function readNumericStat(stats, capitalKey, lowerKey) {
  const val = stats[capitalKey] ?? stats[lowerKey];
  return typeof val === "number" && Number.isFinite(val) && val !== -999 ? val : void 0;
}
function parseHeatmapResult(response, activityId) {
  const result = response.data?.result;
  if (!result) {
    throw new FortyGuardError(
      `Activity '${activityId}' completed without result data.`,
      "MISSING_RESULT"
    );
  }
  let avgTemp;
  let maxTemp;
  let minTemp;
  const statsData = result.stats_data;
  if (statsData) {
    const tempStats = extractTemperatureStats(statsData);
    if (tempStats) {
      avgTemp = readNumericStat(tempStats, "Mean", "mean");
      maxTemp = readNumericStat(tempStats, "Maximum", "maximum");
      minTemp = readNumericStat(tempStats, "Minimum", "minimum");
    }
    if (avgTemp === void 0 && typeof statsData.mean === "number") avgTemp = statsData.mean;
    if (maxTemp === void 0 && typeof statsData.max === "number") maxTemp = statsData.max;
    if (minTemp === void 0 && typeof statsData.min === "number") minTemp = statsData.min;
  }
  const features = result.map_data?.features ?? [];
  if (features.length > 0 && (avgTemp === void 0 || maxTemp === void 0 || minTemp === void 0)) {
    const validTileTemps = [];
    for (const f of features) {
      const p = f.properties;
      const t = p.average_temperature ?? p.temperature ?? p.value;
      if (typeof t === "number" && Number.isFinite(t) && t !== -999) {
        validTileTemps.push(t);
      }
    }
    if (validTileTemps.length > 0) {
      const sum = validTileTemps.reduce((acc, v) => acc + v, 0);
      avgTemp ??= sum / validTileTemps.length;
      maxTemp ??= Math.max(...validTileTemps);
      minTemp ??= Math.min(...validTileTemps);
    }
  }
  if (avgTemp === void 0 || maxTemp === void 0 || minTemp === void 0) {
    throw new FortyGuardError(
      `Activity '${activityId}': Unable to extract valid temperature statistics from response.`,
      "PARSE_ERROR"
    );
  }
  return {
    avgTemperatureCelsius: avgTemp,
    maxTemperatureCelsius: maxTemp,
    minTemperatureCelsius: minTemp,
    tileCount: features.length,
    activityId
  };
}

// server/services/fortyguard/client.ts
var AnalysisRequestBudget = class {
  count = 0;
  maxRequests;
  constructor(maxRequests = CONFIG.fortyguard.budgets.maxTotalRequestsPerAnalysis) {
    this.maxRequests = maxRequests;
  }
  recordRequest() {
    this.count++;
    if (this.count > this.maxRequests) {
      throw new FortyGuardBudgetExceededError(
        `FortyGuard request budget exceeded (${this.count} > ${this.maxRequests} requests). Aborting further API requests to prevent runaway consumption.`
      );
    }
  }
  get totalRequests() {
    return this.count;
  }
  get limit() {
    return this.maxRequests;
  }
};
function getApiKey() {
  const key = process.env.FORTYGUARD_API_KEY;
  if (!key || key.trim() === "") {
    throw new FortyGuardAuthError();
  }
  return key.trim();
}
function buildHeaders() {
  return {
    "api-key": getApiKey(),
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithTimeout(url, options, timeoutMs = CONFIG.fortyguard.requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function fetchWithRetry(url, options, maxRetries = CONFIG.fortyguard.maxRetries, budget) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (budget) {
      budget.recordRequest();
    }
    try {
      const response = await fetchWithTimeout(url, options);
      if (response.status === 401 || response.status === 403) {
        throw new FortyGuardAuthError();
      }
      if (response.status === 429) {
        throw new FortyGuardRateLimitError();
      }
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text().catch(() => "");
        throw new FortyGuardError(
          `FortyGuard API rejected request (HTTP ${response.status}): ${errorText}`,
          "INVALID_REQUEST",
          response.status
        );
      }
      return response;
    } catch (err) {
      if (err instanceof FortyGuardAuthError || err instanceof FortyGuardRateLimitError || err instanceof FortyGuardBudgetExceededError || err instanceof FortyGuardError && err.code === "INVALID_REQUEST") {
        throw err;
      }
      lastError = err;
      if (attempt < maxRetries) {
        const delay = CONFIG.fortyguard.retryBackoffMs * Math.pow(2, attempt);
        console.warn(`[FortyGuard] Transient network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw new FortyGuardError(
    `FortyGuard request failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    "NETWORK_ERROR"
  );
}
async function submitHeatmap(request, budget) {
  const url = `${CONFIG.fortyguard.baseUrl}/v1/heatmap`;
  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(request)
    },
    CONFIG.fortyguard.maxRetries,
    budget
  );
  const data = await response.json();
  if (data.error || !data.data?.activity_id) {
    throw new FortyGuardError(
      data.message || "FortyGuard submission response missing activity_id.",
      "PARSE_ERROR"
    );
  }
  return data.data.activity_id;
}
async function pollUntilComplete(activityId, budget) {
  const url = `${CONFIG.fortyguard.baseUrl}/v1/status/${encodeURIComponent(activityId)}`;
  const deadline = Date.now() + CONFIG.fortyguard.maxPollMs;
  let cycle = 0;
  while (Date.now() < deadline && cycle < CONFIG.fortyguard.maxPollCycles) {
    cycle++;
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: buildHeaders()
      },
      CONFIG.fortyguard.maxRetries,
      budget
    );
    const json = await response.json();
    const status = json.data?.status;
    console.info(`[FortyGuard] Activity ${activityId} poll cycle ${cycle}: Status = ${status}`);
    if (status === "Completed") {
      return json;
    }
    if (status === "Failed") {
      throw new FortyGuardTaskFailedError(activityId);
    }
    await sleep(CONFIG.fortyguard.pollIntervalMs);
  }
  throw new FortyGuardTaskTimeoutError(activityId);
}
async function analyseCorridorHeat(polygonAoi, startDate, startTime = "14:00", budget) {
  const startMs = Date.now();
  const requestPayload = {
    polygon_aoi: polygonAoi,
    date_time: {
      start_date: startDate,
      start_time: startTime,
      filter_type: CONFIG.fortyguard.filterType
    },
    granularity: CONFIG.fortyguard.granularity,
    analytic_type: CONFIG.fortyguard.analyticType
  };
  console.info(`[FortyGuard] Submitting single-hour corridor heatmap for ${startDate} at ${startTime}`);
  const activityId = await submitHeatmap(requestPayload, budget);
  const statusResponse = await pollUntilComplete(activityId, budget);
  const observation = parseHeatmapResult(statusResponse, activityId);
  console.info(
    `[FortyGuard] Analysis finished in ${Date.now() - startMs}ms: Mean=${observation.avgTemperatureCelsius.toFixed(1)}\xB0C, Max=${observation.maxTemperatureCelsius.toFixed(1)}\xB0C, Tiles=${observation.tileCount}`
  );
  return observation;
}

// server/services/scoring/heatScore.ts
function normalize(value, min, max) {
  if (!Number.isFinite(value)) return 0.5;
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
function scoreRoutes(routes) {
  if (routes.length === 0) return [];
  if (routes.length === 1) {
    const route = routes[0];
    return [
      {
        routeId: route.routeId,
        heatScore: null,
        comparisonAvailable: false,
        components: null,
        observation: route.observation,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds
      }
    ];
  }
  const avgTemps = routes.map((r) => r.observation.avgTemperatureCelsius);
  const peakTemps = routes.map((r) => r.observation.maxTemperatureCelsius);
  const distances = routes.map((r) => r.distanceMeters);
  const minAvg = Math.min(...avgTemps);
  const maxAvg = Math.max(...avgTemps);
  const minPeak = Math.min(...peakTemps);
  const maxPeak = Math.max(...peakTemps);
  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);
  const { avgTempWeight, peakTempWeight, distanceWeight, scoreMax } = CONFIG.scoring;
  const scored = routes.map((route) => {
    const normAvg = normalize(route.observation.avgTemperatureCelsius, minAvg, maxAvg);
    const normPeak = normalize(route.observation.maxTemperatureCelsius, minPeak, maxPeak);
    const normDist = normalize(route.distanceMeters, minDist, maxDist);
    const rawScore = avgTempWeight * normAvg + peakTempWeight * normPeak + distanceWeight * normDist;
    const heatScore = Math.round(rawScore * scoreMax);
    return {
      routeId: route.routeId,
      heatScore,
      comparisonAvailable: true,
      components: {
        avgTempScore: Math.round(normAvg * scoreMax),
        peakTempScore: Math.round(normPeak * scoreMax),
        distanceScore: Math.round(normDist * scoreMax)
      },
      observation: route.observation,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds
    };
  });
  return scored.sort((a, b) => (a.heatScore ?? 0) - (b.heatScore ?? 0));
}

// server/services/scoring/ranking.ts
function rankRoutes(scored, _candidateRoutes) {
  if (scored.length <= 1) {
    const single = scored[0];
    const name = "Only Available Route";
    const ranked2 = [
      {
        ...single,
        name,
        rank: null,
        recommended: false
      }
    ];
    return {
      ranked: ranked2,
      recommendation: {
        routeId: single.routeId,
        routeName: name,
        comparisonAvailable: false,
        tradeoffs: null,
        reasons: [
          "Only one route was available, so HeatRoute could not compare heat exposure against alternatives."
        ]
      }
    };
  }
  const ranked = scored.map((s, idx) => {
    let name = `Alternative Route ${String.fromCharCode(65 + idx - 1)}`;
    if (idx === 0) {
      name = "Recommended Route";
    }
    return {
      ...s,
      name,
      rank: idx + 1,
      recommended: idx === 0
    };
  });
  const best = ranked[0];
  const others = ranked.slice(1);
  const nextBest = others[0];
  const avgTempDiffCelsius = nextBest.observation.avgTemperatureCelsius - best.observation.avgTemperatureCelsius;
  const peakTempDiffCelsius = nextBest.observation.maxTemperatureCelsius - best.observation.maxTemperatureCelsius;
  const distanceDiffKm = (best.distanceMeters - Math.min(...ranked.map((r) => r.distanceMeters))) / 1e3;
  const scoreAdvantage = (nextBest.heatScore ?? 0) - (best.heatScore ?? 0);
  const tradeoffs = {
    avgTempDiffCelsius: Math.round(avgTempDiffCelsius * 10) / 10,
    peakTempDiffCelsius: Math.round(peakTempDiffCelsius * 10) / 10,
    distanceDiffKm: Math.round(distanceDiffKm * 10) / 10,
    scoreAdvantage
  };
  const reasons = buildFactualReasons(best, ranked, tradeoffs);
  return {
    ranked,
    recommendation: {
      routeId: best.routeId,
      routeName: best.name,
      comparisonAvailable: true,
      tradeoffs,
      reasons
    }
  };
}
function buildFactualReasons(best, all, tradeoffs) {
  const reasons = [];
  if (all.length <= 1) {
    reasons.push("Only one route was available, so HeatRoute could not compare heat exposure against alternatives.");
    return reasons;
  }
  if (tradeoffs.avgTempDiffCelsius > 0.05) {
    reasons.push(
      `${tradeoffs.avgTempDiffCelsius.toFixed(1)}\xB0C lower average hourly temperature along this corridor.`
    );
  }
  if (tradeoffs.peakTempDiffCelsius > 0.05) {
    reasons.push(
      `${tradeoffs.peakTempDiffCelsius.toFixed(1)}\xB0C lower maximum corridor temperature in the analyzed hour.`
    );
  }
  const isShortest = best.distanceMeters === Math.min(...all.map((r) => r.distanceMeters));
  if (isShortest) {
    reasons.push("Also represents the most direct / shortest travel distance.");
  } else if (tradeoffs.distanceDiffKm > 0) {
    reasons.push(
      `Requires only +${tradeoffs.distanceDiffKm.toFixed(1)} km additional distance for significantly reduced heat exposure (Best heat/distance trade-off).`
    );
  }
  if (tradeoffs.scoreAdvantage > 0) {
    reasons.push(
      `Heat Exposure Score is ${tradeoffs.scoreAdvantage} points lower than the next best alternative.`
    );
  }
  if (reasons.length === 0) {
    reasons.push("Optimal balance of temperature conditions and travel distance.");
  }
  return reasons;
}

// server/routes/analyze.ts
var router = Router();
var activeAnalysesCount = 0;
var MAX_CONCURRENT_ANALYSES = 3;
router.post("/", async (req, res) => {
  const startMs = Date.now();
  console.info("[/api/analyze] Received route analysis request");
  if (activeAnalysesCount >= MAX_CONCURRENT_ANALYSES) {
    res.status(429).json({
      error: true,
      message: "Too many analyses are currently running on the server. Please wait a few seconds and try again."
    });
    return;
  }
  const parseResult = AnalyzeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(" ");
    res.status(422).json({ error: true, message: errorMsg });
    return;
  }
  const { start, destination } = parseResult.data;
  if (Math.abs(start.lat - destination.lat) < 2e-4 && Math.abs(start.lng - destination.lng) < 2e-4) {
    res.status(422).json({
      error: true,
      message: "Start and destination locations must be different."
    });
    return;
  }
  activeAnalysesCount++;
  try {
    console.info("[/api/analyze] Fetching road route alternatives via OSRM...");
    let candidateRoutes;
    try {
      candidateRoutes = await fetchCandidateRoutes(start, destination);
    } catch (err) {
      console.error("[/api/analyze] Routing error:", err instanceof Error ? err.message : String(err));
      res.status(422).json({
        error: true,
        message: err instanceof Error && err.message.includes("No suitable route") ? "No suitable road route could be found between these locations." : "Could not calculate road routes between these locations. Please verify the addresses."
      });
      return;
    }
    const routesToAnalyze = candidateRoutes.slice(0, CONFIG.fortyguard.budgets.maxCandidateRoutes);
    console.info(`[/api/analyze] Evaluating ${routesToAnalyze.length} candidate route(s)`);
    const defaultDateTime = getDefaultAnalysisDateTime();
    const analysisDate = parseResult.data.date || defaultDateTime.date;
    const analysisTime = parseResult.data.time || defaultDateTime.time;
    const budgetTracker = new AnalysisRequestBudget(CONFIG.fortyguard.budgets.maxTotalRequestsPerAnalysis);
    const routeMetrics = [];
    const failedRoutes = [];
    for (let i = 0; i < routesToAnalyze.length; i++) {
      const route = routesToAnalyze[i];
      try {
        console.info(`[/api/analyze] Generating corridor polygon for ${route.name} (${route.id})...`);
        const polygonAoi = buildCorridorPolygon(route.geometry);
        console.info(`[/api/analyze] Calling FortyGuard single-hour heatmap for ${route.id}...`);
        const observation = await analyseCorridorHeat(polygonAoi, analysisDate, analysisTime, budgetTracker);
        routeMetrics.push({
          routeId: route.id,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          observation
        });
      } catch (err) {
        console.warn(
          `[/api/analyze] Route ${route.id} analysis failed: ${err instanceof Error ? err.message : String(err)}`
        );
        failedRoutes.push(route.id);
      }
    }
    if (routeMetrics.length === 0) {
      throw new FortyGuardError(
        "Could not retrieve thermal intelligence for any of the candidate routes.",
        "TASK_FAILED",
        502
      );
    }
    const scored = scoreRoutes(routeMetrics);
    const { ranked, recommendation } = rankRoutes(scored, routesToAnalyze);
    const candidateMap = new Map(routesToAnalyze.map((r) => [r.id, r]));
    const formattedTime = `${analysisTime} (${formatHourAmPm(analysisTime)})`;
    const mappedRoutes = ranked.map((r) => {
      const candidate = candidateMap.get(r.routeId);
      return {
        id: r.routeId,
        name: r.name,
        rank: r.rank,
        recommended: r.recommended,
        comparisonAvailable: r.comparisonAvailable,
        heatScore: r.heatScore,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        avgTemperatureCelsius: Math.round(r.observation.avgTemperatureCelsius * 10) / 10,
        maxTemperatureCelsius: Math.round(r.observation.maxTemperatureCelsius * 10) / 10,
        minTemperatureCelsius: Math.round(r.observation.minTemperatureCelsius * 10) / 10,
        tileCount: r.observation.tileCount,
        activityId: r.observation.activityId,
        geometry: candidate.geometry,
        components: r.components
      };
    });
    const response = {
      routes: mappedRoutes,
      rankedRoutes: mappedRoutes,
      ranked_routes: mappedRoutes,
      recommendation,
      heatStatistics: mappedRoutes.map((r) => ({
        routeId: r.id,
        mean: r.avgTemperatureCelsius,
        maximum: r.maxTemperatureCelsius,
        minimum: r.minTemperatureCelsius,
        tileCount: r.tileCount
      })),
      heat_statistics: mappedRoutes.map((r) => ({
        route_id: r.id,
        mean: r.avgTemperatureCelsius,
        maximum: r.maxTemperatureCelsius,
        minimum: r.minTemperatureCelsius,
        tile_count: r.tileCount
      })),
      analysisTime: {
        date: analysisDate,
        time: analysisTime,
        formatted: formattedTime
      }
    };
    console.info(
      `[/api/analyze] Analysis completed in ${Date.now() - startMs}ms. Comparison: ${recommendation.comparisonAvailable ? "Multi-Route" : "Single-Route"}. Result: ${recommendation.routeName || ranked[0].name} (${ranked[0].heatScore !== null ? `Score: ${ranked[0].heatScore}/100` : "Single Route - No Score"})`
    );
    res.status(200).json(response);
  } catch (err) {
    console.error("[/api/analyze] Pipeline error:", err);
    const userMessage = toUserFacingMessage(err);
    const statusCode = err instanceof FortyGuardError ? err.statusCode : 500;
    res.status(statusCode).json({ error: true, message: userMessage });
  } finally {
    activeAnalysesCount--;
  }
});
function formatHourAmPm(timeStr) {
  const [hourStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
}
var analyze_default = router;

// server/routes/geocode.ts
import { Router as Router2 } from "express";
var router2 = Router2();
var geocodeCache = /* @__PURE__ */ new Map();
router2.get("/", async (req, res) => {
  const queryParam = req.query.q ?? req.query.query;
  if (!queryParam || typeof queryParam !== "string") {
    res.status(400).json({ error: true, message: 'Query parameter "q" or "query" is required.' });
    return;
  }
  const parseResult = GeocodeQuerySchema.safeParse({ q: queryParam });
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(" ");
    res.status(422).json({ error: true, message: errorMsg });
    return;
  }
  const query = parseResult.data.q.toLowerCase();
  const cached = geocodeCache.get(query);
  if (cached && Date.now() - cached.timestamp < CONFIG.geocoding.cacheTtlMs) {
    res.json(cached.data);
    return;
  }
  const url = new URL(`${CONFIG.geocoding.nominatimBaseUrl}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", CONFIG.geocoding.countryCodes);
  url.searchParams.set("addressdetails", "1");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.geocoding.requestTimeoutMs);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": CONFIG.geocoding.userAgent
      }
    });
    if (!response.ok) {
      throw new Error(`Nominatim returned HTTP ${response.status}`);
    }
    const items = await response.json();
    const results = items.map((item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      return {
        lat,
        lng,
        lon: lng,
        displayName: item.display_name,
        display_name: item.display_name,
        name: item.display_name
      };
    }).filter(
      (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.lat >= CONFIG.geo.US_LAT_MIN && r.lat <= CONFIG.geo.US_LAT_MAX && r.lng >= CONFIG.geo.US_LON_MIN && r.lng <= CONFIG.geo.US_LON_MAX
    );
    geocodeCache.set(query, { data: results, timestamp: Date.now() });
    res.json(results);
  } catch (err) {
    console.error("[/api/geocode] Error:", err instanceof Error ? err.message : String(err));
    res.status(502).json({
      error: true,
      message: "Geocoding service is temporarily unreachable. Please try again."
    });
  } finally {
    clearTimeout(timer);
  }
});
var geocode_default = router2;

// server/app.ts
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
var app = express();
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("vercel.app")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api/analyze", analyze_default);
app.use("/api/geocode", geocode_default);
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "HeatRoute API",
    version: "1.0.0",
    fortyguardConfigured: Boolean(process.env.FORTYGUARD_API_KEY),
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err);
  res.status(500).json({
    error: true,
    message: "An unexpected internal server error occurred."
  });
});

// api/index.ts
var index_default = app;
export {
  index_default as default
};
