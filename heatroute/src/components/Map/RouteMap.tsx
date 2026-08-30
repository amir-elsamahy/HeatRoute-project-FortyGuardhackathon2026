import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ScoredRoute, LatLng } from '@/types';

interface RouteMapProps {
  origin: LatLng | null;
  destination: LatLng | null;
  routes: ScoredRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
}

/**
 * Exactly three distinct route colors:
 * - Route 1 / Recommended: Orange (#F97316)
 * - Route 2: Blue (#3B82F6)
 * - Route 3: Light Violet (#A78BFA)
 */
export const ROUTE_COLORS = {
  orange: '#F97316', // Route 1 / Recommended / Only Available
  blue: '#3B82F6',   // Route 2 / Alternative Route A
  violet: '#A78BFA', // Route 3 / Alternative Route B
} as const;

export function getRouteColor(index: number): string {
  if (index === 0) return ROUTE_COLORS.orange;
  if (index === 1) return ROUTE_COLORS.blue;
  return ROUTE_COLORS.violet;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  origin,
  destination,
  routes,
  selectedRouteId,
  onSelectRoute,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylinesLayerRef = useRef<L.FeatureGroup | null>(null);
  const markersLayerRef = useRef<L.FeatureGroup | null>(null);

  // Initialize Map with CARTO Positron Light tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center in Alabama
    const map = L.map(mapContainerRef.current, {
      center: [30.6954, -88.0399],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // High-resolution CARTO Positron Light tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const polylinesGroup = L.featureGroup().addTo(map);
    const markersGroup = L.featureGroup().addTo(map);

    polylinesLayerRef.current = polylinesGroup;
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Polylines when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const polylinesGroup = polylinesLayerRef.current;
    const markersGroup = markersLayerRef.current;

    if (!map || !polylinesGroup || !markersGroup) return;

    polylinesGroup.clearLayers();
    markersGroup.clearLayers();

    // 1. Draw Origin Marker (Black Pin with Orange Flame Center)
    if (origin) {
      const originIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="display:flex; align-items:center; justify-content:center; width:22px; height:22px; background:#09090b; border-radius:50%; box-shadow: 0 4px 10px rgba(0,0,0,0.25);">
            <div style="width:8px; height:8px; background:#F97316; border-radius:50%;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([origin.lat, origin.lng], { icon: originIcon })
        .bindPopup('<strong style="color:#09090b; font-size:12px;">Origin Location</strong>')
        .addTo(markersGroup);
    }

    // 2. Draw Destination Marker (Orange Pin with White Center)
    if (destination) {
      const destIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="display:flex; align-items:center; justify-content:center; width:22px; height:22px; background:#F97316; border-radius:50%; box-shadow: 0 4px 10px rgba(249,115,22,0.35);">
            <div style="width:8px; height:8px; background:#ffffff; border-radius:50%;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([destination.lat, destination.lng], { icon: destIcon })
        .bindPopup('<strong style="color:#F97316; font-size:12px;">Destination Location</strong>')
        .addTo(markersGroup);
    }

    // 3. Draw Route Polylines with Assigned Colors and Casing
    if (routes.length > 0) {
      // Sort routes so selected and recommended are rendered on top
      const sortedRoutes = [...routes].sort((a, b) => {
        if (a.id === selectedRouteId) return 1;
        if (b.id === selectedRouteId) return -1;
        if (a.recommended) return 1;
        if (b.recommended) return -1;
        return 0;
      });

      sortedRoutes.forEach((route) => {
        const isSelected = route.id === selectedRouteId;
        const isRecommended = route.recommended;
        const routeIndex = routes.findIndex((r) => r.id === route.id);
        const color = getRouteColor(routeIndex);

        const latLngs: [number, number][] = route.geometry.coordinates.map((c) => [c.lat, c.lng]);

        // Casing polyline (subtle white halo for contrast against road basemaps)
        const casing = L.polyline(latLngs, {
          color: '#ffffff',
          weight: isSelected ? 8.5 : isRecommended ? 7.5 : 5.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });
        casing.addTo(polylinesGroup);

        // Main polyline with assigned color (Orange for route 0, Blue for route 1, Violet for route 2)
        const polyline = L.polyline(latLngs, {
          color,
          weight: isSelected ? 6.0 : isRecommended ? 5.0 : 3.5,
          opacity: isSelected ? 1.0 : isRecommended ? 0.95 : 0.75,
          lineCap: 'round',
          lineJoin: 'round',
        });

        polyline.on('click', () => onSelectRoute(route.id));
        casing.on('click', () => onSelectRoute(route.id));

        polyline.bindPopup(`
          <div style="font-family:inherit; padding:6px;">
            <div style="font-size:13px; font-weight:700; color:#09090b; margin-bottom:4px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span>${route.name}</span>
              ${route.comparisonAvailable && isRecommended ? '<span style="background:#fff7ed; color:#ea580c; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; border: 1px solid #fed7aa;">★ Recommended</span>' : ''}
            </div>
            <div style="font-size:12px; color:#52525b; line-height:1.5;">
              ${route.heatScore !== null ? `<div><strong>Heat Exposure:</strong> <span style="font-family:monospace; font-weight:700; color:#09090b;">${route.heatScore}/100</span></div>` : '<div><strong>Evaluation:</strong> <span style="color:#71717a;">Only Available Route</span></div>'}
              <div><strong>Mean Temp:</strong> <span style="font-family:monospace; font-weight:600; color:#F97316;">${route.avgTemperatureCelsius.toFixed(1)}°C</span></div>
              <div><strong>Max in Hour:</strong> <span style="font-family:monospace; font-weight:600; color:#dc2626;">${route.maxTemperatureCelsius.toFixed(1)}°C</span></div>
              <div><strong>Distance:</strong> ${(route.distanceMeters / 1000).toFixed(1)} km (~${Math.round(route.durationSeconds / 60)} min)</div>
            </div>
          </div>
        `);

        polyline.addTo(polylinesGroup);
      });

      const bounds = polylinesGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      }
    } else if (origin && destination) {
      const bounds = markersGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
    }
  }, [origin, destination, routes, selectedRouteId, onSelectRoute]);

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Dynamic Map Legend */}
      {routes.length > 0 && (
        <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl p-3 shadow-md text-xs space-y-2.5 max-w-[240px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-900 text-[11px] tracking-tight">
              Route Candidates
            </span>
            <span className="text-[10px] text-zinc-500 font-mono font-medium">
              {routes.length === 1 ? '1 route available' : `${routes.length} routes evaluated`}
            </span>
          </div>

          <div className="space-y-1">
            {routes.map((route, idx) => {
              const isSelected = route.id === selectedRouteId;
              const color = getRouteColor(idx);

              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => onSelectRoute(route.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-xs font-medium">{route.name}</span>
                  </div>
                  {route.heatScore !== null ? (
                    <div className="flex items-center gap-1 font-mono text-[11px] font-semibold flex-shrink-0">
                      <span className={isSelected ? 'text-orange-400' : 'text-zinc-900'}>
                        {route.heatScore}
                      </span>
                      <span className={isSelected ? 'text-zinc-400' : 'text-zinc-400 font-normal'}>
                        /100
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
                      {(route.distanceMeters / 1000).toFixed(1)} km
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
