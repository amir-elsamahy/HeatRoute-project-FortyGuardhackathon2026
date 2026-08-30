/**
 * OSRM (Open Source Routing Machine) Service.
 * Fetches real candidate road routes between two geographic locations.
 */

import { CONFIG } from '../../config';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteGeometry {
  coordinates: LatLng[];
}

export interface CandidateRoute {
  id: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    /** OSRM GeoJSON format: [longitude, latitude] */
    coordinates: [number, number][];
  };
}

interface OsrmResponse {
  code: string;
  routes: OsrmRoute[];
}

/**
 * Fetch candidate driving routes between origin and destination using OSRM.
 */
export async function fetchCandidateRoutes(
  origin: LatLng,
  destination: LatLng,
): Promise<CandidateRoute[]> {
  // Coordinate format in OSRM URL: {lng},{lat};{lng},{lat}
  const coordinatesParam = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const profile = CONFIG.routing.profile;

  const url = new URL(
    `${CONFIG.routing.osrmBaseUrl}/route/v1/${profile}/${coordinatesParam}`,
  );
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'false');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.routing.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': CONFIG.geocoding.userAgent,
      },
    });
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`Routing service unreachable: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`OSRM returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as OsrmResponse;

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No suitable route could be found between these locations.');
  }

  return data.routes
    .slice(0, CONFIG.routing.maxAlternativeRoutes)
    .map((r, idx) => ({
      id: `route-${idx}`,
      name: `Route ${idx + 1}`,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      geometry: {
        // Convert GeoJSON [longitude, latitude] into internal { lat, lng }
        coordinates: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      },
    }));
}
