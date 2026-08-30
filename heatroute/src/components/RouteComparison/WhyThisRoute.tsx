import React from 'react';
import type { RecommendationResult, ScoredRoute } from '@/types';
import { ArrowDownIcon, CheckIcon } from '@heroicons/react/24/solid';

interface WhyThisRouteProps {
  recommendation: RecommendationResult;
  routes: ScoredRoute[];
}

export const WhyThisRoute: React.FC<WhyThisRouteProps> = ({ recommendation, routes }) => {
  const isMultiRoute =
    recommendation.comparisonAvailable && recommendation.tradeoffs !== null && routes.length > 1;
  const recommendedRoute = routes.find((r) => r.id === recommendation.routeId) || routes[0];
  const tradeoffs = recommendation.tradeoffs;

  if (!isMultiRoute || !tradeoffs) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Route Thermal Summary
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
            1 Route Available
          </span>
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Only one road route was available, so HeatRoute could not compare heat exposure against alternatives.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3.5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Why This Route
        </span>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
          {recommendedRoute.name}
        </span>
      </div>

      {/* Factual Tradeoff Metric Grid */}
      <div className="grid grid-cols-3 gap-2 py-1">
        <div className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/70 text-center">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
            Mean Delta
          </span>
          <div className="flex items-center gap-0.5 mt-0.5">
            {tradeoffs.avgTempDiffCelsius > 0 && (
              <ArrowDownIcon className="w-3 h-3 text-emerald-600" />
            )}
            <span className="text-sm font-bold text-zinc-900 font-mono">
              {tradeoffs.avgTempDiffCelsius > 0
                ? `-${tradeoffs.avgTempDiffCelsius.toFixed(1)}°C`
                : '0.0°C'}
            </span>
          </div>
          <span className="text-[9px] text-zinc-400">vs alternatives</span>
        </div>

        <div className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/70 text-center">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
            Peak Delta
          </span>
          <div className="flex items-center gap-0.5 mt-0.5">
            {tradeoffs.peakTempDiffCelsius > 0 && (
              <ArrowDownIcon className="w-3 h-3 text-emerald-600" />
            )}
            <span className="text-sm font-bold text-zinc-900 font-mono">
              {tradeoffs.peakTempDiffCelsius > 0
                ? `-${tradeoffs.peakTempDiffCelsius.toFixed(1)}°C`
                : '0.0°C'}
            </span>
          </div>
          <span className="text-[9px] text-zinc-400">in analyzed hour</span>
        </div>

        <div className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/70 text-center">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
            Distance
          </span>
          <span className="text-sm font-bold text-zinc-900 font-mono mt-0.5">
            {tradeoffs.distanceDiffKm > 0 ? `+${tradeoffs.distanceDiffKm.toFixed(1)} km` : 'Direct'}
          </span>
          <span className="text-[9px] text-zinc-400">vs shortest</span>
        </div>
      </div>

      {/* Factual Decision Evidence Bullets */}
      <div className="space-y-1.5 pt-1 border-t border-zinc-100">
        <ul className="space-y-1">
          {recommendation.reasons.map((reason, i) => (
            <li key={i} className="text-xs text-zinc-700 flex items-start gap-2 leading-relaxed">
              <CheckIcon className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
