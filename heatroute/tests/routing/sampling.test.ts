import { describe, it, expect } from 'vitest';
import { sampleRoutePoints, buildCorridorPolygon } from '../../server/services/routing/sampling';
import type { RouteGeometry } from '../../server/services/routing/osrm';

function makeMockGeometry(pointCount: number): RouteGeometry {
  const coordinates = [];
  for (let i = 0; i < pointCount; i++) {
    coordinates.push({
      lat: 33.5186 + i * 0.002,
      lng: -86.8104 + i * 0.002,
    });
  }
  return { coordinates };
}

describe('Route Sampling and Corridor Tests', () => {
  it('samples N points while strictly preserving first and last point', () => {
    const geo = makeMockGeometry(50);
    const sampled = sampleRoutePoints(geo, 6);

    expect(sampled).toHaveLength(6);
    expect(sampled[0]).toEqual(geo.coordinates[0]);
    expect(sampled[sampled.length - 1]).toEqual(geo.coordinates[geo.coordinates.length - 1]);
  });

  it('builds a closed GeoJSON corridor polygon', () => {
    const geo = makeMockGeometry(10);
    const aoi = buildCorridorPolygon(geo, 6, 150);

    expect(aoi.type).toBe('FeatureCollection');
    expect(aoi.features).toHaveLength(1);
    expect(aoi.features[0].geometry.type).toBe('Polygon');

    const ring = aoi.features[0].geometry.coordinates[0];
    expect(ring.length).toBeGreaterThan(4);

    // Verify polygon is closed (first coord === last coord)
    const first = ring[0];
    const last = ring[ring.length - 1];
    expect(first[0]).toBe(last[0]);
    expect(first[1]).toBe(last[1]);
  });

  it('ensures coordinates are in GeoJSON [longitude, latitude] order', () => {
    const geo = makeMockGeometry(5);
    const aoi = buildCorridorPolygon(geo, 5);
    const firstCoord = aoi.features[0].geometry.coordinates[0][0];

    // In Alabama: Longitude is ~-86.8 (negative), Latitude is ~33.5 (positive)
    expect(firstCoord[0]).toBeLessThan(0); // Longitude is negative in US
    expect(firstCoord[1]).toBeGreaterThan(20); // Latitude is positive
  });
});
