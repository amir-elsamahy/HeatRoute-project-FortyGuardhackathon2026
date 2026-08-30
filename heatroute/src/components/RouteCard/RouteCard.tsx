import React from 'react';
import type { ScoredRoute } from '@/types';
import { HeatScoreBadge } from '@/components/HeatScore/HeatScoreBadge';
import { getRouteColor } from '@/components/Map/RouteMap';
import { ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface RouteCardProps {
  route: ScoredRoute;
  index?: number;
  isSelected: boolean;
  onSelect: (routeId: string) => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  index = 0,
  isSelected,
  onSelect,
}) => {
  const distKm = (route.distanceMeters / 1000).toFixed(1);
  const durationMin = Math.round(route.durationSeconds / 60);
  const routeColor = getRouteColor(index);

  const cardClass = isSelected
    ? 'border-zinc-800 bg-white shadow-xs ring-1 ring-zinc-800/10'
    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50';

  return (
    <div
      onClick={() => onSelect(route.id)}
      className={`p-4 rounded-xl border transition-all cursor-pointer ${cardClass} space-y-3 relative overflow-hidden`}
    >
      {/* Route Color Stripe Indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: routeColor }}
      />

      {/* Header Row */}
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: routeColor }}
          />
          <span className="text-sm font-bold text-zinc-900 tracking-tight">{route.name}</span>
          {route.comparisonAvailable && route.recommended && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F97316] text-white uppercase tracking-wider">
              Recommended
            </span>
          )}
          {route.comparisonAvailable && !route.recommended && (
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white uppercase tracking-wider"
              style={{ backgroundColor: routeColor }}
            >
              Alternative
            </span>
          )}
        </div>

        {route.comparisonAvailable && route.rank !== null ? (
          <span className="text-[11px] font-mono font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
            Rank #{route.rank}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Only Route Available
          </span>
        )}
      </div>

      {/* Comparative Score (Multi-Route Only) */}
      {route.comparisonAvailable && route.heatScore !== null && (
        <div className="pl-1">
          <HeatScoreBadge score={route.heatScore} />
        </div>
      )}

      {/* Single Route Informational Notice */}
      {!route.comparisonAvailable && (
        <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/80 p-2.5 rounded-lg ml-1">
          Only one road route was available, so HeatRoute could not compare heat exposure against alternatives.
        </div>
      )}

      {/* FortyGuard Thermal Intelligence Footprint */}
      <div className="space-y-1.5 pt-2 border-t border-zinc-100 pl-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
          <span>FortyGuard Thermal Footprint</span>
          <span className="font-mono text-zinc-400 font-normal">{route.tileCount} tiles sampled</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/70">
            <div className="text-[10px] font-medium text-zinc-500">Mean Temp</div>
            <div className="text-xs font-bold text-zinc-900 font-mono mt-0.5">
              {route.avgTemperatureCelsius.toFixed(1)}°C
            </div>
          </div>

          <div className="p-2 rounded-lg bg-orange-50/60 border border-orange-200/60">
            <div className="text-[10px] font-medium text-orange-800">Max in Hour</div>
            <div className="text-xs font-bold text-orange-700 font-mono mt-0.5">
              {route.maxTemperatureCelsius.toFixed(1)}°C
            </div>
          </div>

          <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/70">
            <div className="text-[10px] font-medium text-zinc-500">Min Temp</div>
            <div className="text-xs font-bold text-zinc-700 font-mono mt-0.5">
              {route.minTemperatureCelsius.toFixed(1)}°C
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Metrics */}
      <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100 pl-1">
        <div className="flex items-center gap-1.5">
          <MapPinIcon className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-700 font-medium">{distKm} km</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ClockIcon className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-700 font-medium">~{durationMin} min (driving)</span>
        </div>
      </div>
    </div>
  );
};
