import React from 'react';
import type { DemoPresetPair } from '@/types';

export const ALABAMA_PRESETS: DemoPresetPair[] = [
  {
    id: 'mobile-primary',
    city: 'Mobile, AL',
    label: 'Mobile → Spring Hill',
    description: 'Port district · Western campus',
    origin: {
      name: 'Downtown Mobile',
      displayName: 'Downtown Mobile, AL',
      lat: 30.6954,
      lng: -88.0399,
    },
    destination: {
      name: 'Spring Hill, Mobile',
      displayName: 'Spring Hill, Mobile, AL',
      lat: 30.6944,
      lng: -88.1380,
    },
  },
  {
    id: 'huntsville-secondary',
    city: 'Huntsville, AL',
    label: 'Huntsville → Research Park',
    description: 'Downtown · Cummings Research Park',
    origin: {
      name: 'Downtown Huntsville',
      displayName: 'Downtown Huntsville, AL',
      lat: 34.7304,
      lng: -86.5861,
    },
    destination: {
      name: 'Cummings Research Park',
      displayName: 'Cummings Research Park, Huntsville, AL',
      lat: 34.7230,
      lng: -86.6800,
    },
  },
  {
    id: 'birmingham-single',
    city: 'Birmingham, AL',
    label: 'Birmingham → Homewood',
    description: 'Downtown · Southern ridge',
    origin: {
      name: 'Downtown Birmingham',
      displayName: 'Downtown Birmingham, AL',
      lat: 33.5186,
      lng: -86.8104,
    },
    destination: {
      name: 'Homewood, AL',
      displayName: 'Homewood, AL',
      lat: 33.4800,
      lng: -86.7700,
    },
  },
  {
    id: 'montgomery-single',
    city: 'Montgomery, AL',
    label: 'Montgomery → EastChase',
    description: 'Downtown · Eastern corridor',
    origin: {
      name: 'Downtown Montgomery',
      displayName: 'Downtown Montgomery, AL',
      lat: 32.3792,
      lng: -86.3077,
    },
    destination: {
      name: 'EastChase, Montgomery',
      displayName: 'The Shoppes at EastChase, Montgomery, AL',
      lat: 32.3610,
      lng: -86.1620,
    },
  },
];

interface PresetSelectorProps {
  selectedPresetId?: string | null;
  onSelectPreset: (preset: DemoPresetPair) => void;
  disabled?: boolean;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPresetId,
  onSelectPreset,
  disabled,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Try an Alabama Route
        </span>
        <span className="text-[10px] text-zinc-400">Select to populate</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {ALABAMA_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(preset)}
              className={`text-left px-3 py-2 rounded-lg border transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                isSelected
                  ? 'border-orange-500 bg-orange-50/60 ring-1 ring-orange-500/20 text-zinc-900 font-semibold shadow-2xs'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/70 text-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`truncate text-xs ${isSelected ? 'font-bold text-zinc-950' : 'font-semibold text-zinc-900'}`}>
                  {preset.label}
                </span>
                <span className={`text-[11px] transition-transform ${isSelected ? 'text-orange-600 font-bold' : 'text-zinc-400'}`}>
                  →
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate font-normal">
                {preset.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
