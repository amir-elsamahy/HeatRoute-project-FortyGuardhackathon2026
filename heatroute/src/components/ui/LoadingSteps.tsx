import React from 'react';
import type { ProgressStep } from '@/types';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface LoadingStepsProps {
  steps: ProgressStep[];
}

export const LoadingSteps: React.FC<LoadingStepsProps> = ({ steps }) => {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        Thermal Analysis Progress
      </div>
      <div className="space-y-2.5">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2.5 text-xs">
            {step.status === 'done' && (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
            {step.status === 'active' && (
              <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin flex-shrink-0" />
            )}
            {step.status === 'pending' && (
              <div className="w-4 h-4 rounded-full border border-zinc-200 bg-zinc-100 flex-shrink-0" />
            )}
            {step.status === 'error' && (
              <div className="w-4 h-4 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                ✕
              </div>
            )}
            <span
              className={`transition-colors ${
                step.status === 'active'
                  ? 'text-orange-700 font-semibold'
                  : step.status === 'done'
                  ? 'text-zinc-800 font-medium'
                  : step.status === 'error'
                  ? 'text-rose-600 font-medium'
                  : 'text-zinc-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
