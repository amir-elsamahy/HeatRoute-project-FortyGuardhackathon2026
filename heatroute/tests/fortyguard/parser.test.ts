import { describe, it, expect } from 'vitest';
import { parseHeatmapResult } from '../../server/services/fortyguard/parser';
import type { RawStatusResponse } from '../../server/services/fortyguard/types';

describe('FortyGuard Parser Tests', () => {
  it('correctly extracts Temperature_stats fields', () => {
    const response: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Completed',
      data: {
        activity_id: 'act-1',
        status: 'Completed',
        result: {
          stats_data: {
            Temperature_stats: {
              Mean: 31.4,
              Maximum: 38.6,
              Minimum: 24.2,
            },
          },
        },
      },
    };

    const obs = parseHeatmapResult(response, 'act-1');
    expect(obs.avgTemperatureCelsius).toBe(31.4);
    expect(obs.maxTemperatureCelsius).toBe(38.6);
    expect(obs.minTemperatureCelsius).toBe(24.2);
  });

  it('filters out legacy missing -999 values', () => {
    const response: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Completed',
      data: {
        activity_id: 'act-missing',
        status: 'Completed',
        result: {
          stats_data: {
            Temperature_stats: {
              Mean: -999,
              Maximum: -999,
              Minimum: -999,
            },
          },
          map_data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[]] },
                properties: { tile_id: 't1', average_temperature: 30.0 },
              },
              {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[]] },
                properties: { tile_id: 't2', average_temperature: 34.0 },
              },
            ],
          },
        },
      },
    };

    // Falls back to tile features since -999 is ignored
    const obs = parseHeatmapResult(response, 'act-missing');
    expect(obs.avgTemperatureCelsius).toBe(32.0);
    expect(obs.maxTemperatureCelsius).toBe(34.0);
    expect(obs.minTemperatureCelsius).toBe(30.0);
  });

  it('aggregates tile-level features if stats_data is empty', () => {
    const response: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Completed',
      data: {
        activity_id: 'act-tile-only',
        status: 'Completed',
        result: {
          map_data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[]] },
                properties: { tile_id: 't1', temperature: 28.0 },
              },
              {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[]] },
                properties: { tile_id: 't2', temperature: 32.0 },
              },
            ],
          },
        },
      },
    };

    const obs = parseHeatmapResult(response, 'act-tile-only');
    expect(obs.avgTemperatureCelsius).toBe(30.0);
    expect(obs.maxTemperatureCelsius).toBe(32.0);
    expect(obs.minTemperatureCelsius).toBe(28.0);
    expect(obs.tileCount).toBe(2);
  });
});
