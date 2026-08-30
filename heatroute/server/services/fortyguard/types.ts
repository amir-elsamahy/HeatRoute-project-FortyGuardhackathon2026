/**
 * FortyGuard API raw & normalized TypeScript definitions.
 * Documented per FortyGuard tOS Enterprise API specification.
 */

// ---------------------------------------------------------------------------
// 1. Raw API Submission Response (POST /v1/heatmap)
// ---------------------------------------------------------------------------

export interface RawSubmissionResponse {
  error: boolean;
  status_code: number;
  message: string;
  data: {
    activity_id: string;
  };
}

// ---------------------------------------------------------------------------
// 2. Raw API Status Response (GET /v1/status/{activity_id})
// ---------------------------------------------------------------------------

export type RawTaskStatus = 'Processing' | 'Completed' | 'Failed';

export interface RawHeatmapTileProperties {
  tile_id: string;
  temperature?: number;
  average_temperature?: number;
  min_temperature?: number;
  max_temperature?: number;
  value?: number;
}

export interface RawHeatmapFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    /** GeoJSON coordinate ordering: [longitude, latitude] */
    coordinates: number[][][];
  };
  properties: RawHeatmapTileProperties;
}

export interface RawHeatmapMapData {
  type: 'FeatureCollection';
  features: RawHeatmapFeature[];
}

export interface RawTemperatureStats {
  Minimum?: number;
  Maximum?: number;
  Mean?: number;
  Standard_deviation?: number;
  minimum?: number;
  maximum?: number;
  mean?: number;
  standard_deviation?: number;
}

export interface RawStatsData {
  Temperature_stats?: RawTemperatureStats;
  temperature_stats?: RawTemperatureStats;
  Overall_temperature_distribution?: number[];
  overall_temperature_distribution?: number[];
  analytic_type?: string;
  units?: string;
  n_cells?: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface RawHeatmapResult {
  map_data?: RawHeatmapMapData;
  stats_data?: RawStatsData;
}

export interface RawStatusResponse {
  error: boolean;
  status_code: number;
  message: string;
  data: {
    activity_id: string;
    status: RawTaskStatus;
    result?: RawHeatmapResult;
  };
}

// ---------------------------------------------------------------------------
// 3. Raw Heatmap Request Payload
// ---------------------------------------------------------------------------

export interface RawHeatmapRequest {
  polygon_aoi: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: Record<string, unknown>;
      geometry: {
        type: 'Polygon';
        /** GeoJSON: [longitude, latitude] */
        coordinates: number[][][];
      };
    }>;
  };
  date_time: {
    start_date: string;
    filter_type: 1 | 2 | 3 | 4;
    start_time?: string;
    end_time?: string;
    end_date?: string;
  };
  granularity: 60 | 80 | 100;
  analytic_type?: 'tcm' | 'time_of_measure' | 'exceedance' | 'persistence';
  threshold?: number;
  direction?: 'above' | 'below';
}

// ---------------------------------------------------------------------------
// 4. Normalized Internal Heat Observation
// ---------------------------------------------------------------------------

export interface HeatObservation {
  /** Average temperature (°C) across the route corridor */
  avgTemperatureCelsius: number;
  /** Peak / maximum temperature (°C) */
  maxTemperatureCelsius: number;
  /** Minimum temperature (°C) */
  minTemperatureCelsius: number;
  /** Number of tiles sampled */
  tileCount: number;
  /** FortyGuard activity ID for auditability */
  activityId: string;
}
