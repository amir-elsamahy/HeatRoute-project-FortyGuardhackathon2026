import React from 'react';

interface HeatScoreBadgeProps {
  score: number | null;
  showDetails?: boolean;
}

export const HeatScoreBadge: React.FC<HeatScoreBadgeProps> = ({ score, showDetails = false }) => {
  if (score === null || score === undefined) {
    return null;
  }

  let level = 'Lower Relative Exposure';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let barColor = 'bg-emerald-500';

  if (score >= 65) {
    level = 'Higher Relative Exposure';
    badgeColor = 'bg-orange-50 text-orange-700 border-orange-200';
    barColor = 'bg-orange-600';
  } else if (score >= 40) {
    level = 'Mid Relative Exposure';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    barColor = 'bg-amber-500';
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-zinc-900">Heat Exposure Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${badgeColor}`}
          >
            {level}
          </span>
          <span className="text-sm font-bold text-zinc-900 font-mono">
            {score}<span className="text-xs font-normal text-zinc-500">/100</span>
          </span>
        </div>
      </div>

      {/* Comparative Gauge Bar */}
      <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
        <div
          className={`h-full ${barColor} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(Math.max(score, 4), 100)}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
        <span>0 — Best relative route</span>
        <span>100 — Highest relative exposure</span>
      </div>

      {showDetails && (
        <div className="text-[10px] text-zinc-500 italic">
          *Relative to candidate routes evaluated for this specific trip.
        </div>
      )}
    </div>
  );
};
