import { describe, it, expect } from 'vitest';
import { scoreRoutes, type RouteMetrics } from '@server/services/scoring/heatScore';
import { rankRoutes } from '@server/services/scoring/ranking';
import type { CandidateRoute } from '@server/services/routing/osrm';

function makeMockCandidate(id: string, name: string, distanceMeters: number): CandidateRoute {
  return {
    id,
    name,
    distanceMeters,
    durationSeconds: distanceMeters / 10,
    geometry: { coordinates: [] },
  };
}

function makeMockRouteMetrics(
  routeId: string,
  avgTemp: number,
  maxTemp: number,
  distanceMeters: number,
): RouteMetrics {
  return {
    routeId,
    distanceMeters,
    durationSeconds: distanceMeters / 10,
    observation: {
      avgTemperatureCelsius: avgTemp,
      maxTemperatureCelsius: maxTemp,
      minTemperatureCelsius: avgTemp - 2,
      tileCount: 15,
      activityId: `act-${routeId}`,
    },
  };
}

describe('Ranking and Factual Tradeoffs Engine', () => {
  it('identifies best route and calculates factual temperature & distance tradeoffs for multiple routes', () => {
    const candidates = [
      makeMockCandidate('route-0', 'Direct Highway', 3000),
      makeMockCandidate('route-1', 'Canopy Parkway', 3400),
    ];

    const metrics = [
      makeMockRouteMetrics('route-0', 36.0, 41.0, 3000), // Hot & Direct
      makeMockRouteMetrics('route-1', 30.0, 33.0, 3400), // Cool & +0.4km
    ];

    const scored = scoreRoutes(metrics);
    const { ranked, recommendation } = rankRoutes(scored, candidates);

    expect(ranked[0].routeId).toBe('route-1');
    expect(ranked[0].recommended).toBe(true);
    expect(ranked[0].rank).toBe(1);

    expect(recommendation.routeId).toBe('route-1');
    expect(recommendation.comparisonAvailable).toBe(true);
    expect(recommendation.tradeoffs).not.toBeNull();
    expect(recommendation.tradeoffs?.avgTempDiffCelsius).toBe(6.0); // 36 - 30
    expect(recommendation.tradeoffs?.peakTempDiffCelsius).toBe(8.0); // 41 - 33
    expect(recommendation.tradeoffs?.distanceDiffKm).toBe(0.4); // 3.4 - 3.0

    // Check factual reasons
    expect(recommendation.reasons.length).toBeGreaterThan(0);
    const hasTempAdvantage = recommendation.reasons.some((r) => r.includes('6.0°C lower average'));
    expect(hasTempAdvantage).toBe(true);
  });

  it('handles single route correctly without claiming recommendation or comparative score', () => {
    const candidates = [makeMockCandidate('route-0', 'Sole Highway', 4500)];
    const metrics = [makeMockRouteMetrics('route-0', 34.0, 37.0, 4500)];

    const scored = scoreRoutes(metrics);
    const { ranked, recommendation } = rankRoutes(scored, candidates);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].heatScore).toBeNull();
    expect(ranked[0].comparisonAvailable).toBe(false);
    expect(ranked[0].recommended).toBe(false);
    expect(ranked[0].rank).toBeNull();

    expect(recommendation.comparisonAvailable).toBe(false);
    expect(recommendation.tradeoffs).toBeNull();
    expect(recommendation.reasons[0]).toContain('Only one route was available');
  });
});
