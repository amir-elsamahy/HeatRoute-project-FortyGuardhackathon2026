import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPinIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { searchLocations, type GeocodeSuggestion } from '@/services/api';
import type { LatLng } from '@/types';

interface LocationInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  coordinates: LatLng | null;
  iconType?: 'start' | 'end';
  disabled?: boolean;
  onLocationSelected: (location: { displayName: string; lat: number; lng: number }) => void;
  onClear: () => void;
}

export const LocationInput: React.FC<LocationInputProps> = ({
  id,
  label,
  placeholder,
  value,
  coordinates,
  iconType = 'start',
  disabled = false,
  onLocationSelected,
  onClear,
}) => {
  const [inputText, setInputText] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const results = await searchLocations(query, controller.signal);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Could not fetch suggestions.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputText(newVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(newVal);
    }, 500);
  };

  const handleSelectSuggestion = (suggestion: GeocodeSuggestion) => {
    setInputText(suggestion.displayName);
    setIsOpen(false);
    setSuggestions([]);
    onLocationSelected({
      displayName: suggestion.displayName,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
  };

  const handleClear = () => {
    setInputText('');
    setSuggestions([]);
    setIsOpen(false);
    setError(null);
    onClear();
  };

  const pinColor = iconType === 'start' ? 'text-orange-600' : 'text-zinc-800';

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-zinc-900 tracking-tight">
          {label}
        </label>
        {coordinates && (
          <span className="text-[10px] text-zinc-600 font-mono">
            {coordinates.lat.toFixed(4)}°N, {Math.abs(coordinates.lng).toFixed(4)}°W
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <div className={`absolute left-3.5 ${pinColor} pointer-events-none`}>
          <MapPinIcon className="w-4 h-4" />
        </div>
        <input
          id={id}
          type="text"
          disabled={disabled}
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-zinc-300 hover:border-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900/20 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs font-medium"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3.5 w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
        )}
        {!loading && inputText && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 text-zinc-400 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
            aria-label="Clear location"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <div className="text-[11px] text-orange-600 px-1 font-medium">{error}</div>}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5 text-xs divide-y divide-zinc-100">
          {suggestions.map((item, idx) => (
            <li
              key={`${item.lat}-${item.lng}-${idx}`}
              onClick={() => handleSelectSuggestion(item)}
              className="px-3.5 py-2.5 hover:bg-zinc-50 cursor-pointer text-zinc-800 transition-colors flex items-start gap-2.5"
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2 leading-relaxed text-zinc-700 font-medium">{item.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
