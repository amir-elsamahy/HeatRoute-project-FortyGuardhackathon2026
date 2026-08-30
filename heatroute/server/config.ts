/**
 * Central configuration constants for HeatRoute Server & Pipeline.
 */

export const CONFIG = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  fortyguard: {
    baseUrl: 'https://api.fortyguard.com',
    /** Granularity in meters (60, 80, or 100) */
    granularity: 100 as 60 | 80 | 100,
    /** Filter type: 1 = Single Hour (snapshot for selected hour) */
    filterType: 1 as 1 | 2 | 3 | 4,
    /** Analytic type: 'tcm' for temperature snapshot in °C */
    analyticType: 'tcm' as const,
    /** Maximum time to wait for asynchronous task completion (ms) */
    maxPollMs: 120_000,
    /** Polling interval (ms) */
    pollIntervalMs: 3_000,
    /** Max polling cycles guard */
    maxPollCycles: 40,
    /** Max retries on transient network errors */
    maxRetries: 2,
    /** Backoff delay base (ms) */
    retryBackoffMs: 1_000,
    /** Request timeout for individual calls (ms) */
    requestTimeoutMs: 30_000,
    /**
     * Maximum supported AOI area in square miles.
     * 10 mi² is the conservative fallback for Basic/Startup plans;
     * 50 mi² is available on Premium plans.
     */
    maxAreaSqMiles: parseFloat(process.env.FORTYGUARD_MAX_AOI_AREA_MI2 || '10'),
    /** Hard budget limits per route analysis to prevent accidental infinite loops/excessive billing */
    budgets: {
      maxCandidateRoutes: 3,
      maxHeatmapSubmissionsPerAnalysis: 3,
      maxStatusPollsPerActivity: 40,
      maxTotalRequestsPerAnalysis: 40,
    },
  },

  routing: {
    osrmBaseUrl: 'https://router.project-osrm.org',
    profile: 'driving' as const,
    maxAlternativeRoutes: 3,
    samplesPerRoute: 6,
    corridorBufferMeters: 200,
    requestTimeoutMs: 15_000,
  },

  geocoding: {
    nominatimBaseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: 'HeatRouteApp/1.0',
    requestTimeoutMs: 10_000,
    countryCodes: 'us',
    minQueryLength: 3,
    cacheTtlMs: 3600_000, // 1 hour in-memory cache
  },

  scoring: {
    avgTempWeight: 0.50,
    peakTempWeight: 0.30,
    distanceWeight: 0.20,
    scoreMax: 100,
  },

  /**
   * Geographic prefilter bounds for United States.
   * Contiguous US bounding box: Lat [24.0, 50.0], Lng [-126.0, -66.0].
   */
  geo: {
    US_LAT_MIN: 24.0,
    US_LAT_MAX: 50.0,
    US_LON_MIN: -126.0,
    US_LON_MAX: -66.0,
    defaultDemoCenter: {
      lat: 33.5186,
      lng: -86.8104,
      name: 'Birmingham, AL',
    },
  },
} as const;
