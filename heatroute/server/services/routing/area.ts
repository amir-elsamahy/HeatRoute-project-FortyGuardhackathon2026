/**
 * Geodesic and polygon area calculation utilities.
 * Used to ensure route corridor polygons do not exceed the configured FortyGuard AOI limit.
 */

import { CONFIG } from '@server/config';

const EARTH_RADIUS_METERS = 6371000;
const SQ_METERS_PER_SQ_MILE = 2589988.11;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Computes the approximate surface area of a spherical polygon in square miles
 * using the spherical excess / Girard's theorem for GeoJSON coordinates [lng, lat].
 */
export function calculatePolygonAreaSqMiles(ring: [number, number][]): number {
  if (ring.length < 3) return 0;

  let totalAngle = 0;
  const n = ring.length;

  for (let i = 0; i < n - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % (n - 1)];

    const lon1 = toRadians(p1[0]);
    const lat1 = toRadians(p1[1]);
    const lon2 = toRadians(p2[0]);
    const lat2 = toRadians(p2[1]);

    totalAngle += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaSqMeters = Math.abs((totalAngle * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 4.0);
  return areaSqMeters / SQ_METERS_PER_SQ_MILE;
}

/**
 * Validates whether a polygon's area is within the configured FortyGuard maximum AOI limit.
 */
export function validateAoiArea(
  ring: [number, number][],
  maxAreaSqMiles: number = CONFIG.fortyguard.maxAreaSqMiles,
): { valid: boolean; areaSqMiles: number; limitSqMiles: number } {
  const areaSqMiles = calculatePolygonAreaSqMiles(ring);
  return {
    valid: areaSqMiles <= maxAreaSqMiles,
    areaSqMiles,
    limitSqMiles: maxAreaSqMiles,
  };
}
