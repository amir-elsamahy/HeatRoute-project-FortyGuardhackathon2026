/**
 * Geocoding Proxy Route (GET /api/geocode).
 * Proxies Nominatim OpenStreetMap geocoding with in-memory caching and US boundary filtering.
 */

import { Router, Request, Response } from 'express';
import { CONFIG } from '@server/config';
import { GeocodeQuerySchema } from '@server/services/fortyguard/schemas';

const router = Router();

interface GeocodeCacheEntry {
  data: unknown;
  timestamp: number;
}

const geocodeCache = new Map<string, GeocodeCacheEntry>();

export interface GeocodeResult {
  lat: number;
  lng: number;
  lon: number;
  displayName: string;
  display_name: string;
  name: string;
}

interface NominatimRawItem {
  lat: string;
  lon: string;
  display_name: string;
}

router.get('/', async (req: Request, res: Response) => {
  const queryParam = req.query.q ?? req.query.query;
  if (!queryParam || typeof queryParam !== 'string') {
    res.status(400).json({ error: true, message: 'Query parameter "q" or "query" is required.' });
    return;
  }

  const parseResult = GeocodeQuerySchema.safeParse({ q: queryParam });
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(' ');
    res.status(422).json({ error: true, message: errorMsg });
    return;
  }

  const query = parseResult.data.q.toLowerCase();

  // Check in-memory cache
  const cached = geocodeCache.get(query);
  if (cached && Date.now() - cached.timestamp < CONFIG.geocoding.cacheTtlMs) {
    res.json(cached.data);
    return;
  }

  const url = new URL(`${CONFIG.geocoding.nominatimBaseUrl}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', CONFIG.geocoding.countryCodes);
  url.searchParams.set('addressdetails', '1');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.geocoding.requestTimeoutMs);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': CONFIG.geocoding.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned HTTP ${response.status}`);
    }

    const items = (await response.json()) as NominatimRawItem[];

    const results: GeocodeResult[] = items
      .map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        return {
          lat,
          lng,
          lon: lng,
          displayName: item.display_name,
          display_name: item.display_name,
          name: item.display_name,
        };
      })
      .filter(
        (r) =>
          Number.isFinite(r.lat) &&
          Number.isFinite(r.lng) &&
          r.lat >= CONFIG.geo.US_LAT_MIN &&
          r.lat <= CONFIG.geo.US_LAT_MAX &&
          r.lng >= CONFIG.geo.US_LON_MIN &&
          r.lng <= CONFIG.geo.US_LON_MAX,
      );

    // Save to cache
    geocodeCache.set(query, { data: results, timestamp: Date.now() });

    res.json(results);
  } catch (err) {
    console.error('[/api/geocode] Error:', err instanceof Error ? err.message : String(err));
    res.status(502).json({
      error: true,
      message: 'Geocoding service is temporarily unreachable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
