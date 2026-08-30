import { describe, it, expect } from 'vitest';
import { scoreRoutes, normalize, type RouteMetrics } from '@server/services/scoring/heatScore';

function makeMockRouteMetrics(
  routeId: string,
  avgTemp: number,
  maxTemp: number,
  distanceMeters: number,
): RouteMetrics {
  return {
    routeId,
    distanceMeters,
    durationSeconds: distanceMeters / 12,
    observation: {
      avgTemperatureCelsius: avgTemp,
      maxTemperatureCelsius: maxTemp,
      minTemperatureCelsius: avgTemp - 3,
      tileCount: 20,
      activityId: `act-${routeId}`,
    },
  };
}

describe('Heat Score Engine Tests', () => {
  describe('normalize()', () => {
    it('normalizes within [min, max] range to [0, 1]', () => {
      expect(normalize(30, 20, 40)).toBe(0.5);
      expect(normalize(20, 20, 40)).toBe(0);
      expect(normalize(40, 20, 40)).toBe(1);
    });

    it('returns 0.5 when min === max (division-by-zero protection)', () => {
      expect(normalize(35, 35, 35)).toBe(0.5);
    });

    it('clamps values beyond min/max', () => {
      expect(normalize(10, 20, 40)).toBe(0);
      expect(normalize(50, 20, 40)).toBe(1);
    });
  });

  describe('scoreRoutes()', () => {
    it('ranks cooler route first (lower score = less heat exposed)', () => {
      const coolRoute = makeMockRouteMetrics('cool', 29.0, 32.0, 3500);
      const hotRoute = makeMockRouteMetrics('hot', 38.0, 42.0, 3000);

      const scored = scoreRoutes([hotRoute, coolRoute]);

      expect(scored[0].routeId).toBe('cool');
      expect(scored[1].routeId).toBe('hot');
      expect(scored[0].heatScore).toBeLessThan(scored[1].heatScore!);
      expect(scored[0].comparisonAvailable).toBe(true);
    });

    it('sets heatScore to null and comparisonAvailable to false when only one route is evaluated', () => {
      const single = makeMockRouteMetrics('single', 32.0, 36.0, 2000);
      const scored = scoreRoutes([single]);

      expect(scored).toHaveLength(1);
      expect(scored[0].heatScore).toBeNull();
      expect(scored[0].comparisonAvailable).toBe(false);
      expect(scored[0].components).toBeNull();
    });

    it('is strictly deterministic across multiple runs with identical input', () => {
      const r1 = makeMockRouteMetrics('r1', 30.0, 34.0, 2500);
      const r2 = makeMockRouteMetrics('r2', 33.0, 37.0, 2200);
      const r3 = makeMockRouteMetrics('r3', 28.0, 31.0, 2800);

      const run1 = scoreRoutes([r1, r2, r3]);
      const run2 = scoreRoutes([r1, r2, r3]);

      expect(run1.map((r) => r.heatScore)).toEqual(run2.map((r) => r.heatScore));
      expect(run1.map((r) => r.routeId)).toEqual(run2.map((r) => r.routeId));
    });

    it('penalizes distance when thermal conditions are equal', () => {
      const shortRoute = makeMockRouteMetrics('short', 32.0, 35.0, 1000);
      const longRoute = makeMockRouteMetrics('long', 32.0, 35.0, 5000);

      const scored = scoreRoutes([shortRoute, longRoute]);

      expect(scored[0].routeId).toBe('short');
      expect(scored[0].heatScore).toBeLessThan(scored[1].heatScore!);
    });
  });
});
