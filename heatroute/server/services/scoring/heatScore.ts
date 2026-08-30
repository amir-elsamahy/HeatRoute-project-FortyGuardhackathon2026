/**
 * Heat Exposure Scoring Engine.
 *
 * Computes an explainable, deterministic Heat Exposure Score (0–100) per candidate route.
 *
 * Single-Route Rule:
 *   When only one candidate route is evaluated, no comparative Heat Exposure Score is generated.
 *   heatScore is set to null, and comparisonAvailable is false.
 *
 * Multi-Route Formula (>= 2 candidates):
 *   normalizedAvgTemp  = normalize(route.avgTemp, minAvg, maxAvg)
 *   normalizedPeakTemp = normalize(route.peakTemp, minPeak, maxPeak)
 *   normalizedDistance = normalize(route.distance, minDist, maxDist)
 *
 *   Heat Exposure Score = Math.round(
 *     (0.50 * normalizedAvgTemp + 0.30 * normalizedPeakTemp + 0.20 * normalizedDistance) * 100
 *   )
 *
 * Note on Terminology:
 *   For Single-Hour tcm analysis, "peakTemp" refers to the maximum tile temperature
 *   observed within that analyzed hour and AOI corridor. It is not a daily peak.
 *   This score is a HeatRoute comparative decision metric, not an occupational health standard.
 */

import { CONFIG } from '@server/config';
import type { HeatObservation } from '@server/services/fortyguard/types';

export interface RouteMetrics {
  routeId: string;
  distanceMeters: number;
  durationSeconds: number;
  observation: HeatObservation;
}

export interface ScoreComponents {
  avgTempScore: number;
  peakTempScore: number;
  distanceScore: number;
}

export interface ScoredRoute {
  routeId: string;
  heatScore: number | null;
  comparisonAvailable: boolean;
  components: ScoreComponents | null;
  observation: HeatObservation;
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Normalizes a scalar value into [0, 1] relative to the candidate pool [min, max].
 * Returns 0.5 if all candidate routes have identical values (avoiding division by zero).
 */
export function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Computes comparative Heat Exposure Scores for candidate routes.
 * When fewer than 2 routes exist, returns routes with heatScore = null and comparisonAvailable = false.
 * Output array is sorted ascending by heatScore when scores exist.
 */
export function scoreRoutes(routes: RouteMetrics[]): ScoredRoute[] {
  if (routes.length === 0) return [];

  // Single Route Rule: Do NOT compute a fake comparative score when no alternatives exist.
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
        durationSeconds: route.durationSeconds,
      },
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

  const scored: ScoredRoute[] = routes.map((route) => {
    const normAvg = normalize(route.observation.avgTemperatureCelsius, minAvg, maxAvg);
    const normPeak = normalize(route.observation.maxTemperatureCelsius, minPeak, maxPeak);
    const normDist = normalize(route.distanceMeters, minDist, maxDist);

    const rawScore =
      avgTempWeight * normAvg +
      peakTempWeight * normPeak +
      distanceWeight * normDist;

    const heatScore = Math.round(rawScore * scoreMax);

    return {
      routeId: route.routeId,
      heatScore,
      comparisonAvailable: true,
      components: {
        avgTempScore: Math.round(normAvg * scoreMax),
        peakTempScore: Math.round(normPeak * scoreMax),
        distanceScore: Math.round(normDist * scoreMax),
      },
      observation: route.observation,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
    };
  });

  return scored.sort((a, b) => (a.heatScore ?? 0) - (b.heatScore ?? 0));
}
