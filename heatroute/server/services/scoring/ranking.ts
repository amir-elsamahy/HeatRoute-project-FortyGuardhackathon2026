/**
 * Route Ranking and Explainable Tradeoff Engine.
 * Generates factual "Why this route?" trade-off points based strictly on computed metrics.
 */

import type { ScoredRoute } from './heatScore';
import type { CandidateRoute } from '../routing/osrm';

export interface TradeoffSummary {
  avgTempDiffCelsius: number;
  peakTempDiffCelsius: number;
  distanceDiffKm: number;
  scoreAdvantage: number;
}

export interface RankedRoute extends ScoredRoute {
  name: string;
  rank: number | null;
  recommended: boolean;
}

export interface RecommendationResult {
  routeId: string | null;
  routeName: string | null;
  comparisonAvailable: boolean;
  tradeoffs: TradeoffSummary | null;
  reasons: string[];
}

/**
 * Ranks scored routes and produces a factual recommendation.
 * For single routes: does not claim recommendation or rank, explicitly marks comparisonAvailable = false.
 */
export function rankRoutes(
  scored: ScoredRoute[],
  _candidateRoutes: CandidateRoute[],
): { ranked: RankedRoute[]; recommendation: RecommendationResult } {
  // Handle single route case
  if (scored.length <= 1) {
    const single = scored[0];
    const name = 'Only Available Route';
    const ranked: RankedRoute[] = [
      {
        ...single,
        name,
        rank: null,
        recommended: false,
      },
    ];

    return {
      ranked,
      recommendation: {
        routeId: single.routeId,
        routeName: name,
        comparisonAvailable: false,
        tradeoffs: null,
        reasons: [
          'Only one route was available, so HeatRoute could not compare heat exposure against alternatives.',
        ],
      },
    };
  }

  // Multi-route case: rank by lowest heat score (Rank 1 = lowest score = Recommended)
  const ranked: RankedRoute[] = scored.map((s, idx) => {
    let name = `Alternative Route ${String.fromCharCode(65 + idx - 1)}`; // A, B
    if (idx === 0) {
      name = 'Recommended Route';
    }
    return {
      ...s,
      name,
      rank: idx + 1,
      recommended: idx === 0,
    };
  });

  const best = ranked[0];
  const others = ranked.slice(1);

  // Compute factual tradeoffs relative to alternatives
  const nextBest = others[0];
  const avgTempDiffCelsius = nextBest.observation.avgTemperatureCelsius - best.observation.avgTemperatureCelsius;
  const peakTempDiffCelsius = nextBest.observation.maxTemperatureCelsius - best.observation.maxTemperatureCelsius;
  const distanceDiffKm = (best.distanceMeters - Math.min(...ranked.map((r) => r.distanceMeters))) / 1000;
  const scoreAdvantage = (nextBest.heatScore ?? 0) - (best.heatScore ?? 0);

  const tradeoffs: TradeoffSummary = {
    avgTempDiffCelsius: Math.round(avgTempDiffCelsius * 10) / 10,
    peakTempDiffCelsius: Math.round(peakTempDiffCelsius * 10) / 10,
    distanceDiffKm: Math.round(distanceDiffKm * 10) / 10,
    scoreAdvantage,
  };

  const reasons = buildFactualReasons(best, ranked, tradeoffs);

  return {
    ranked,
    recommendation: {
      routeId: best.routeId,
      routeName: best.name,
      comparisonAvailable: true,
      tradeoffs,
      reasons,
    },
  };
}

function buildFactualReasons(
  best: RankedRoute,
  all: RankedRoute[],
  tradeoffs: TradeoffSummary,
): string[] {
  const reasons: string[] = [];

  if (all.length <= 1) {
    reasons.push('Only one route was available, so HeatRoute could not compare heat exposure against alternatives.');
    return reasons;
  }

  if (tradeoffs.avgTempDiffCelsius > 0.05) {
    reasons.push(
      `${tradeoffs.avgTempDiffCelsius.toFixed(1)}°C lower average hourly temperature along this corridor.`,
    );
  }

  if (tradeoffs.peakTempDiffCelsius > 0.05) {
    reasons.push(
      `${tradeoffs.peakTempDiffCelsius.toFixed(1)}°C lower maximum corridor temperature in the analyzed hour.`,
    );
  }

  const isShortest = best.distanceMeters === Math.min(...all.map((r) => r.distanceMeters));
  if (isShortest) {
    reasons.push('Also represents the most direct / shortest travel distance.');
  } else if (tradeoffs.distanceDiffKm > 0) {
    reasons.push(
      `Requires only +${tradeoffs.distanceDiffKm.toFixed(1)} km additional distance for significantly reduced heat exposure (Best heat/distance trade-off).`,
    );
  }

  if (tradeoffs.scoreAdvantage > 0) {
    reasons.push(
      `Heat Exposure Score is ${tradeoffs.scoreAdvantage} points lower than the next best alternative.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('Optimal balance of temperature conditions and travel distance.');
  }

  return reasons;
}
