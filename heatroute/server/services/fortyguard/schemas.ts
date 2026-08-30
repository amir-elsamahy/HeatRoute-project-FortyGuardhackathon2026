/**
 * Zod validation schemas and geographic prefilters for HeatRoute.
 */

import { z } from 'zod';
import { CONFIG } from '../../config';

// ---------------------------------------------------------------------------
// 1. Geographic Coordinate Schema (With US Prefilter Validation)
// ---------------------------------------------------------------------------

export const LatLngSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const lat = typeof obj.lat === 'string' ? parseFloat(obj.lat) : obj.lat;
      const rawLng = obj.lng ?? obj.lon;
      const lng = typeof rawLng === 'string' ? parseFloat(rawLng) : rawLng;
      return { lat, lng };
    }
    return val;
  },
  z.object({
    lat: z
      .number({ error: 'Latitude is required and must be numeric.' })
      .min(CONFIG.geo.US_LAT_MIN, `Latitude must be within US bounds (min: ${CONFIG.geo.US_LAT_MIN}°N).`)
      .max(CONFIG.geo.US_LAT_MAX, `Latitude must be within US bounds (max: ${CONFIG.geo.US_LAT_MAX}°N).`),
    lng: z
      .number({ error: 'Longitude is required and must be numeric.' })
      .min(CONFIG.geo.US_LON_MIN, `Longitude must be within US bounds (min: ${CONFIG.geo.US_LON_MIN}°W).`)
      .max(CONFIG.geo.US_LON_MAX, `Longitude must be within US bounds (max: ${CONFIG.geo.US_LON_MAX}°W).`),
  }),
);

export type LatLngInput = z.infer<typeof LatLngSchema>;

// ---------------------------------------------------------------------------
// 2. Route Analysis Request (POST /api/analyze)
// ---------------------------------------------------------------------------

export const AnalyzeRequestSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const start = obj.start ?? obj.origin;
      const destination = obj.destination ?? obj.dest ?? obj.end;
      return { ...obj, start, destination };
    }
    return val;
  },
  z.object({
    start: LatLngSchema,
    destination: LatLngSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD.').optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be formatted as HH:MM in 24-hour time.').optional(),
  }),
);

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ---------------------------------------------------------------------------
// 3. Geocoding Request (GET /api/geocode?q=... or ?query=...)
// ---------------------------------------------------------------------------

export const GeocodeQuerySchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const q = obj.q ?? obj.query;
      return { ...obj, q };
    }
    return val;
  },
  z.object({
    q: z
      .string({ error: 'Search query parameter "q" or "query" is required.' })
      .min(CONFIG.geocoding.minQueryLength, `Search query must be at least ${CONFIG.geocoding.minQueryLength} characters.`)
      .max(150, 'Search query is too long.')
      .trim(),
  }),
);

export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;

// ---------------------------------------------------------------------------
// 4. Output Response Schemas
// ---------------------------------------------------------------------------

export const TradeoffSummarySchema = z.object({
  avgTempDiffCelsius: z.number(),
  peakTempDiffCelsius: z.number(),
  distanceDiffKm: z.number(),
  scoreAdvantage: z.number(),
});

export const RecommendationResultSchema = z.object({
  routeId: z.string().nullable(),
  routeName: z.string().nullable(),
  comparisonAvailable: z.boolean(),
  tradeoffs: TradeoffSummarySchema.nullable(),
  reasons: z.array(z.string()),
});

export const ScoreComponentsSchema = z.object({
  avgTempScore: z.number(),
  peakTempScore: z.number(),
  distanceScore: z.number(),
});

export const ScoredRouteSchema = z.object({
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
    coordinates: z.array(z.object({ lat: z.number(), lng: z.number() })),
  }),
  components: ScoreComponentsSchema.nullable(),
});

export const AnalyzeResponseSchema = z.object({
  routes: z.array(ScoredRouteSchema),
  rankedRoutes: z.array(ScoredRouteSchema).optional(),
  ranked_routes: z.array(ScoredRouteSchema).optional(),
  recommendation: RecommendationResultSchema,
  heatStatistics: z.array(z.any()).optional(),
  heat_statistics: z.array(z.any()).optional(),
  analysisTime: z.object({
    date: z.string(),
    time: z.string(),
    formatted: z.string(),
  }),
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
