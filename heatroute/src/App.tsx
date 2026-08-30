import React, { useState, useRef, useCallback } from 'react';
import type { LatLng, AnalyzeResponse, ProgressStep, DemoPresetPair, ScoredRoute } from '@/types';
import { fetchRouteAnalysis } from '@/services/api';
import { RouteMap } from '@/components/Map/RouteMap';
import { LocationInput } from '@/components/LocationSearch/LocationInput';
import { PresetSelector, ALABAMA_PRESETS } from '@/components/LocationSearch/PresetSelector';
import { RouteCard } from '@/components/RouteCard/RouteCard';
import { WhyThisRoute } from '@/components/RouteComparison/WhyThisRoute';
import { LoadingSteps } from '@/components/ui/LoadingSteps';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TimeBadge } from '@/components/ui/TimeBadge';
import {
  FireIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  XMarkIcon,
  ArrowRightIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';

const INITIAL_STEPS: ProgressStep[] = [
  { id: '1', label: 'Resolving locations & querying road routes (OSRM)...', status: 'pending' },
  { id: '2', label: 'Constructing route corridor polygons (≤10 sq mi)...', status: 'pending' },
  { id: '3', label: 'Querying FortyGuard LTM Single-Hour Heatmap...', status: 'pending' },
  { id: '4', label: 'Computing Heat Exposure Scores & evaluating tradeoffs...', status: 'pending' },
];

const HOUR_OPTIONS = [
  { value: '08:00', label: '8:00 AM (Morning Commute)' },
  { value: '10:00', label: '10:00 AM (Late Morning)' },
  { value: '12:00', label: '12:00 PM (Midday)' },
  { value: '14:00', label: '2:00 PM (Afternoon — Default)' },
  { value: '16:00', label: '4:00 PM (Late Afternoon)' },
  { value: '18:00', label: '6:00 PM (Evening Commute)' },
];

export const App: React.FC = () => {
  // Location States (Default to Mobile Primary Preset)
  const defaultPreset = ALABAMA_PRESETS[0];
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(defaultPreset.id);
  const [originText, setOriginText] = useState(defaultPreset.origin.displayName);
  const [originCoords, setOriginCoords] = useState<LatLng | null>({
    lat: defaultPreset.origin.lat,
    lng: defaultPreset.origin.lng,
  });

  const [destText, setDestText] = useState(defaultPreset.destination.displayName);
  const [destCoords, setDestCoords] = useState<LatLng | null>({
    lat: defaultPreset.destination.lat,
    lng: defaultPreset.destination.lng,
  });

  const [selectedHour, setSelectedHour] = useState<string>('14:00');

  // Pipeline Execution States
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>(INITIAL_STEPS);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSelectPreset = (preset: DemoPresetPair) => {
    setSelectedPresetId(preset.id);
    setOriginText(preset.origin.displayName);
    setOriginCoords({ lat: preset.origin.lat, lng: preset.origin.lng });
    setDestText(preset.destination.displayName);
    setDestCoords({ lat: preset.destination.lat, lng: preset.destination.lng });
    setAnalysisResult(null);
    setErrorMessage(null);
  };

  const handleAnalyze = useCallback(async () => {
    if (!originCoords || !destCoords || loading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorMessage(null);
    setAnalysisResult(null);

    setSteps([
      { id: '1', label: 'Resolving locations & querying road routes (OSRM)...', status: 'active' },
      { id: '2', label: 'Constructing route corridor polygons (≤10 sq mi)...', status: 'pending' },
      { id: '3', label: 'Querying FortyGuard LTM Single-Hour Heatmap...', status: 'pending' },
      { id: '4', label: 'Computing Heat Exposure Scores & evaluating tradeoffs...', status: 'pending' },
    ]);

    const step2Timer = setTimeout(() => {
      setSteps((prev: ProgressStep[]) =>
        prev.map((s: ProgressStep) =>
          s.id === '1' ? { ...s, status: 'done' } : s.id === '2' ? { ...s, status: 'active' } : s,
        ),
      );
    }, 1200);

    const step3Timer = setTimeout(() => {
      setSteps((prev: ProgressStep[]) =>
        prev.map((s: ProgressStep) =>
          s.id === '2' ? { ...s, status: 'done' } : s.id === '3' ? { ...s, status: 'active' } : s,
        ),
      );
    }, 3000);

    try {
      const result = await fetchRouteAnalysis(originCoords, destCoords, {
        time: selectedHour,
        signal: controller.signal,
      });

      clearTimeout(step2Timer);
      clearTimeout(step3Timer);

      setSteps([
        { id: '1', label: 'Road route alternatives retrieved (OSRM)', status: 'done' },
        { id: '2', label: 'Corridor polygons buffered within AOI limits', status: 'done' },
        { id: '3', label: 'FortyGuard thermal data retrieved & parsed', status: 'done' },
        { id: '4', label: 'Heat Exposure Scores & recommendation finalized', status: 'done' },
      ]);

      setAnalysisResult(result);
      setSelectedRouteId(result.recommendation.routeId || result.routes[0]?.id || null);
    } catch (err) {
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);

      if (err instanceof Error && err.name === 'AbortError') return;

      const message = err instanceof Error ? err.message : 'An error occurred during analysis.';
      setErrorMessage(message);
      setSteps((prev: ProgressStep[]) =>
        prev.map((s: ProgressStep) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
      );
    } finally {
      setLoading(false);
    }
  }, [originCoords, destCoords, selectedHour, loading]);

  const canAnalyze = originCoords !== null && destCoords !== null && !loading;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500 text-white shadow-2xs">
              <FireIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-zinc-950">HeatRoute</span>
                <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200">
                  Resilient Cities & Infrastructure
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-normal">
                Intelligent heat-aware routing powered by FortyGuard LTM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors shadow-2xs cursor-pointer"
          >
            <InformationCircleIcon className="w-4 h-4 text-orange-600" />
            <span>How It Works</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Grid ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Controls, Presets & Decisions (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto">
          {/* Main Task Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4 shadow-2xs">
            <div>
              <h1 className="text-sm font-bold text-zinc-950 tracking-tight">
                Find a route with less heat exposure
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                Compare alternative road corridors and score thermal exposure using FortyGuard microclimate intelligence.
              </p>
            </div>

            {/* Inputs Form */}
            <div className="space-y-3 pt-1">
              <LocationInput
                id="origin-search"
                label="Origin"
                placeholder="e.g. Downtown Mobile, AL"
                value={originText}
                coordinates={originCoords}
                iconType="start"
                disabled={loading}
                onLocationSelected={(loc) => {
                  setSelectedPresetId(null);
                  setOriginText(loc.displayName);
                  setOriginCoords({ lat: loc.lat, lng: loc.lng });
                }}
                onClear={() => {
                  setSelectedPresetId(null);
                  setOriginText('');
                  setOriginCoords(null);
                }}
              />

              <LocationInput
                id="dest-search"
                label="Destination"
                placeholder="e.g. Spring Hill, Mobile, AL"
                value={destText}
                coordinates={destCoords}
                iconType="end"
                disabled={loading}
                onLocationSelected={(loc) => {
                  setSelectedPresetId(null);
                  setDestText(loc.displayName);
                  setDestCoords({ lat: loc.lat, lng: loc.lng });
                }}
                onClear={() => {
                  setSelectedPresetId(null);
                  setDestText('');
                  setDestCoords(null);
                }}
              />

              {/* Analysis Hour Selector */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hour-select" className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Target Analysis Hour</span>
                </label>
                <select
                  id="hour-select"
                  disabled={loading}
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {HOUR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                disabled={!canAnalyze}
                onClick={handleAnalyze}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 bg-[#F97316] hover:bg-orange-600 active:bg-orange-700 text-white shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Thermal Exposure...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Heat Exposure</span>
                    <ArrowRightIcon className="w-3.5 h-3.5 text-white/90" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compact Alabama Routes Selector */}
          <PresetSelector
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            disabled={loading}
          />

          {/* Error Banner */}
          {errorMessage && (
            <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          )}

          {/* Loading Steps */}
          {loading && <LoadingSteps steps={steps} />}

          {/* Analysis Results Section */}
          {analysisResult && (
            <div className="space-y-3.5">
              <TimeBadge timeInfo={analysisResult.analysisTime} />

              {/* Factual Decision Tradeoff Component */}
              <WhyThisRoute
                recommendation={analysisResult.recommendation}
                routes={analysisResult.routes}
              />

              {/* Candidate Routes List */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                  {analysisResult.routes.length === 1
                    ? 'Evaluated Route (1 path)'
                    : `Evaluated Candidate Routes (${analysisResult.routes.length} paths)`}
                </div>
                {analysisResult.routes.map((route: ScoredRoute, idx: number) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    index={idx}
                    isSelected={selectedRouteId === route.id}
                    onSelect={(id) => setSelectedRouteId(id)}
                  />
                ))}
              </div>

              {/* Restrained Disclaimer */}
              <div className="text-[11px] text-zinc-500 flex items-start gap-2 p-3 bg-zinc-100/70 rounded-xl border border-zinc-200">
                <ShieldCheckIcon className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Heat Exposure Score is a comparative decision metric derived by HeatRoute from FortyGuard LTM
                  temperature intelligence when multiple candidate routes exist.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Leaflet Map (7 cols) */}
        <div className="lg:col-span-7 h-[460px] lg:h-[calc(100vh-100px)] sticky top-16">
          <RouteMap
            origin={originCoords}
            destination={destCoords}
            routes={analysisResult?.routes || []}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id) => setSelectedRouteId(id)}
          />
        </div>
      </main>

      {/* ── How It Works Modal ───────────────────────────────────────────── */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                  <FireIcon className="w-4 h-4 text-orange-600" />
                </div>
                <h3 className="font-bold text-zinc-900 text-sm">How HeatRoute Works</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
                aria-label="Close dialog"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
              <p>
                <strong>FortyGuard Hackathon'26:</strong> HeatRoute addresses the{' '}
                <span className="text-zinc-900 font-semibold underline decoration-orange-500">
                  Resilient Cities & Infrastructure
                </span>{' '}
                challenge track by empowering drivers, municipal fleets, and pedestrians to identify road corridors that minimize urban heat exposure.
              </p>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1.5">
                <div className="font-bold text-zinc-900 text-xs">4-Step Decision Pipeline:</div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-700">
                  <li><strong>Route Alternatives:</strong> Queries OSRM for authentic road geometries.</li>
                  <li><strong>Corridor Buffering:</strong> Builds a 200m buffered polygon AOI (verified ≤10 sq mi).</li>
                  <li><strong>FortyGuard LTM:</strong> Dispatches Single-Hour Heatmap request (`tcm` model).</li>
                  <li><strong>Scoring & Tradeoffs:</strong> Computes relative Heat Exposure Score and factual tradeoffs.</li>
                </ol>
              </div>

              <div>
                <div className="font-bold text-zinc-900 mb-1">
                  Heat Exposure Scoring Formula:
                </div>
                <div className="p-2.5 bg-zinc-900 font-mono text-[11px] rounded-lg text-zinc-100">
                  score = (0.50 × normAvgTemp + 0.30 × normPeakTemp + 0.20 × normDistance) × 100
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  *Normalized across candidate routes for this trip. Lower score = cooler path.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 font-bold text-white rounded-lg text-xs cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
