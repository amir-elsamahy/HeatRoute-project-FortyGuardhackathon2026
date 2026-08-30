/**
 * Typed client API service for communicating with HeatRoute backend.
 */

import type { LatLng, AnalyzeResponse } from '@/types';

export interface GeocodeSuggestion {
  lat: number;
  lng: number;
  displayName: string;
}

export async function fetchRouteAnalysis(
  start: LatLng,
  destination: LatLng,
  options?: {
    date?: string;
    time?: string;
    signal?: AbortSignal;
  },
): Promise<AnalyzeResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      start,
      destination,
      date: options?.date,
      time: options?.time,
    }),
    signal: options?.signal,
  });

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => '');
    data = { message: text || `Analysis failed (HTTP ${response.status})` };
  }

  if (!response.ok || data.error) {
    throw new Error(data.message || `Analysis failed (HTTP ${response.status})`);
  }

  return data as AnalyzeResponse;
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 3) return [];

  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Location search failed.');
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.message || 'Geocoding service error.');
  }

  return (data as GeocodeSuggestion[]) || [];
}
