/**
 * Client-side TypeScript definitions for HeatRoute.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteGeometry {
  coordinates: LatLng[];
}

export interface ScoreComponents {
  avgTempScore: number;
  peakTempScore: number;
  distanceScore: number;
}

export interface ScoredRoute {
  id: string;
  name: string;
  rank: number | null;
  recommended: boolean;
  comparisonAvailable: boolean;
  heatScore: number | null;
  distanceMeters: number;
  durationSeconds: number;
  avgTemperatureCelsius: number;
  maxTemperatureCelsius: number;
  minTemperatureCelsius: number;
  tileCount: number;
  activityId: string;
  geometry: RouteGeometry;
  components: ScoreComponents | null;
}

export interface TradeoffSummary {
  avgTempDiffCelsius: number;
  peakTempDiffCelsius: number;
  distanceDiffKm: number;
  scoreAdvantage: number;
}

export interface RecommendationResult {
  routeId: string | null;
  routeName: string | null;
  comparisonAvailable: boolean;
  tradeoffs: TradeoffSummary | null;
  reasons: string[];
}

export interface AnalysisTimeInfo {
  date: string;
  time: string;
  formatted: string;
}

export interface AnalyzeResponse {
  routes: ScoredRoute[];
  recommendation: RecommendationResult;
  analysisTime: AnalysisTimeInfo;
}

export interface PresetLocation {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface DemoPresetPair {
  id: string;
  city: string;
  label: string;
  description: string;
  origin: PresetLocation;
  destination: PresetLocation;
}

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
}
