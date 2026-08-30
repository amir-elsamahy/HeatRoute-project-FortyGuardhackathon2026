/**
 * Route sampling and controlled corridor polygon builder.
 *
 * Rather than creating a wide convex hull across distant turns,
 * this module constructs a tightly buffered corridor polygon along the
 * actual traveled road route, converts coordinates into GeoJSON standard [lng, lat],
 * and validates the resulting AOI area against FortyGuard limits.
 */

import { CONFIG } from '@server/config';
import type { LatLng, RouteGeometry } from './osrm';
import type { RawHeatmapRequest } from '@server/services/fortyguard/types';
import { validateAoiArea } from './area';
import { FortyGuardError } from '@server/services/fortyguard/errors';

const METERS_PER_DEGREE_LAT = 111132.954;

/**
 * Samples N representative points along a route geometry.
 * Always preserves origin (first point) and destination (last point).
 */
export function sampleRoutePoints(
  geometry: RouteGeometry,
  maxPoints: number = CONFIG.routing.samplesPerRoute,
): LatLng[] {
  const coords = geometry.coordinates;
  if (!coords || coords.length === 0) return [];
  if (coords.length <= maxPoints) return [...coords];

  const sampled: LatLng[] = [];
  const step = (coords.length - 1) / (maxPoints - 1);

  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), coords.length - 1);
    sampled.push(coords[idx]);
  }

  return sampled;
}

/**
 * Generates a left and right offset point for a route segment.
 */
function offsetPoint(
  p1: LatLng,
  p2: LatLng,
  bufferMeters: number,
  side: 'left' | 'right',
): LatLng {
  const dx = (p2.lng - p1.lng) * Math.cos(((p1.lat + p2.lat) / 2) * (Math.PI / 180));
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normal unit vector
  const nx = -dy / len;
  const ny = dx / len;

  const sign = side === 'left' ? 1 : -1;
  const latOffset = (sign * ny * bufferMeters) / METERS_PER_DEGREE_LAT;
  const lngOffset = (sign * nx * bufferMeters) / (METERS_PER_DEGREE_LAT * Math.cos(p1.lat * (Math.PI / 180)));

  return {
    lat: p1.lat + latOffset,
    lng: p1.lng + lngOffset,
  };
}

/**
 * Constructs a tightly buffered corridor polygon around the sampled route waypoints.
 * GeoJSON coordinate order: [longitude, latitude].
 */
export function buildCorridorPolygon(
  geometry: RouteGeometry,
  maxPoints: number = CONFIG.routing.samplesPerRoute,
  bufferMeters: number = CONFIG.routing.corridorBufferMeters,
): RawHeatmapRequest['polygon_aoi'] {
  const sampled = sampleRoutePoints(geometry, maxPoints);
  if (sampled.length < 2) {
    throw new Error('Route geometry must have at least 2 points to form a corridor.');
  }

  const leftRing: LatLng[] = [];
  const rightRing: LatLng[] = [];

  for (let i = 0; i < sampled.length; i++) {
    const curr = sampled[i];
    const next = sampled[i + 1] || sampled[i];
    const prev = sampled[i - 1] || sampled[i];

    const refNext = i === sampled.length - 1 ? curr : next;
    const refPrev = i === 0 ? curr : prev;

    const p1 = i === 0 ? curr : refPrev;
    const p2 = i === sampled.length - 1 ? curr : refNext;

    leftRing.push(offsetPoint(curr, p2 === curr ? p1 : p2, bufferMeters, 'left'));
    rightRing.push(offsetPoint(curr, p2 === curr ? p1 : p2, bufferMeters, 'right'));
  }

  // Combine forward along left ring and backward along right ring
  const fullPolygonPoints = [...leftRing, ...rightRing.reverse()];
  
  // Close the polygon ring
  fullPolygonPoints.push(fullPolygonPoints[0]);

  // Convert to GeoJSON [longitude, latitude]
  const coordinates: [number, number][] = fullPolygonPoints.map((p) => [p.lng, p.lat]);

  // Area limit validation
  const areaCheck = validateAoiArea(coordinates);
  if (!areaCheck.valid) {
    throw new FortyGuardError(
      `Route corridor area (${areaCheck.areaSqMiles.toFixed(1)} sq mi) exceeds the configured FortyGuard AOI limit (${areaCheck.limitSqMiles} sq mi).`,
      'INVALID_REQUEST',
      422,
    );
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          areaSqMiles: areaCheck.areaSqMiles,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      },
    ],
  };
}

/**
 * Returns default analysis date and time (YYYY-MM-DD and HH:00).
 * Per FortyGuard rules: Dates supported 2019-01-01 to 12h past now.
 * We default to yesterday at 14:00 (selected afternoon snapshot hour).
 */
export function getDefaultAnalysisDateTime(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() - 1); // Yesterday
  const date = d.toISOString().split('T')[0];
  const time = '14:00'; // Default 2:00 PM snapshot
  return { date, time };
}
