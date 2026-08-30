/**
 * FortyGuard Response Parser.
 * Normalizes raw FortyGuard status responses into typed HeatObservation models.
 * Handles casing variations across API versions and provides tile-level fallbacks.
 */

import type { RawStatusResponse, RawStatsData, RawTemperatureStats, HeatObservation } from './types';
import { FortyGuardError } from './errors';

function extractTemperatureStats(stats: RawStatsData): RawTemperatureStats | null {
  return stats.Temperature_stats ?? stats.temperature_stats ?? null;
}

function readNumericStat(
  stats: RawTemperatureStats,
  capitalKey: keyof RawTemperatureStats,
  lowerKey: keyof RawTemperatureStats,
): number | undefined {
  const val = stats[capitalKey] ?? stats[lowerKey];
  return typeof val === 'number' && Number.isFinite(val) && val !== -999 ? val : undefined;
}

/**
 * Parses a completed FortyGuard status response into a structured HeatObservation.
 */
export function parseHeatmapResult(
  response: RawStatusResponse,
  activityId: string,
): HeatObservation {
  const result = response.data?.result;
  if (!result) {
    throw new FortyGuardError(
      `Activity '${activityId}' completed without result data.`,
      'MISSING_RESULT',
    );
  }

  let avgTemp: number | undefined;
  let maxTemp: number | undefined;
  let minTemp: number | undefined;

  const statsData = result.stats_data;
  if (statsData) {
    const tempStats = extractTemperatureStats(statsData);
    if (tempStats) {
      avgTemp = readNumericStat(tempStats, 'Mean', 'mean');
      maxTemp = readNumericStat(tempStats, 'Maximum', 'maximum');
      minTemp = readNumericStat(tempStats, 'Minimum', 'minimum');
    }
    // Also check direct min/max/mean on stats_data (used in analysis heatmaps)
    if (avgTemp === undefined && typeof statsData.mean === 'number') avgTemp = statsData.mean;
    if (maxTemp === undefined && typeof statsData.max === 'number') maxTemp = statsData.max;
    if (minTemp === undefined && typeof statsData.min === 'number') minTemp = statsData.min;
  }

  // Fallback: Compute stats from tile features if stats_data is incomplete
  const features = result.map_data?.features ?? [];
  if (features.length > 0 && (avgTemp === undefined || maxTemp === undefined || minTemp === undefined)) {
    const validTileTemps: number[] = [];
    for (const f of features) {
      const p = f.properties;
      // In filter_type 3: average_temperature, in filter_type 1: temperature
      const t = p.average_temperature ?? p.temperature ?? p.value;
      if (typeof t === 'number' && Number.isFinite(t) && t !== -999) {
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

  if (avgTemp === undefined || maxTemp === undefined || minTemp === undefined) {
    throw new FortyGuardError(
      `Activity '${activityId}': Unable to extract valid temperature statistics from response.`,
      'PARSE_ERROR',
    );
  }

  return {
    avgTemperatureCelsius: avgTemp,
    maxTemperatureCelsius: maxTemp,
    minTemperatureCelsius: minTemp,
    tileCount: features.length,
    activityId,
  };
}
