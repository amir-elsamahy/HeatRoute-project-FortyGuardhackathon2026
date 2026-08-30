import React from 'react';
import { ClockIcon, CalendarIcon } from '@heroicons/react/24/outline';
import type { AnalysisTimeInfo } from '@/types';

interface TimeBadgeProps {
  timeInfo: AnalysisTimeInfo;
}

export const TimeBadge: React.FC<TimeBadgeProps> = ({ timeInfo }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 shadow-xs">
      <div className="flex items-center gap-1.5 text-zinc-900 font-semibold">
        <ClockIcon className="w-4 h-4 text-orange-600" />
        <span>FortyGuard Analysis Snapshot:</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-zinc-700">
        <span className="flex items-center gap-1">
          <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
          {timeInfo.date}
        </span>
        <span className="text-zinc-400">•</span>
        <span className="font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
          {timeInfo.formatted}
        </span>
      </div>
    </div>
  );
};

