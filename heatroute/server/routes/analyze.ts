/**
 * Route Analysis Route (POST /api/analyze).
 * Orchestrates: Geocoding Validation -> OSRM Routing -> Corridor Buffering -> FortyGuard Heatmap -> Scoring -> Ranking.
 */

import { Router, Request, Response } from 'express';
import { CONFIG } from '@server/config';
import { AnalyzeRequestSchema, type AnalyzeResponse } from '@server/services/fortyguard/schemas';
import { fetchCandidateRoutes, type CandidateRoute } from '@server/services/routing/osrm';
import { buildCorridorPolygon, getDefaultAnalysisDateTime } from '@server/services/routing/sampling';
import { analyseCorridorHeat, AnalysisRequestBudget } from '@server/services/fortyguard/client';
import { scoreRoutes, type RouteMetrics } from '@server/services/scoring/heatScore';
import { rankRoutes } from '@server/services/scoring/ranking';
import { toUserFacingMessage, FortyGuardError } from '@server/services/fortyguard/errors';

const router = Router();

// Concurrent request guard to prevent duplicate rapid submissions from flooding the API
let activeAnalysesCount = 0;
const MAX_CONCURRENT_ANALYSES = 3;

router.post('/', async (req: Request, res: Response) => {
  const startMs = Date.now();
  console.info('[/api/analyze] Received route analysis request');

  if (activeAnalysesCount >= MAX_CONCURRENT_ANALYSES) {
    res.status(429).json({
      error: true,
      message: 'Too many analyses are currently running on the server. Please wait a few seconds and try again.',
    });
    return;
  }

  // 1. Validate Input Payload with Zod & US prefilter bounds
  const parseResult = AnalyzeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(' ');
    res.status(422).json({ error: true, message: errorMsg });
    return;
  }

  const { start, destination } = parseResult.data;

  // Check if start and destination are essentially identical (< 15 meters)
  if (
    Math.abs(start.lat - destination.lat) < 0.0002 &&
    Math.abs(start.lng - destination.lng) < 0.0002
  ) {
    res.status(422).json({
      error: true,
      message: 'Start and destination locations must be different.',
    });
    return;
  }

  activeAnalysesCount++;

  try {
    // 2. Fetch Real Candidate Routes via OSRM
    console.info('[/api/analyze] Fetching road route alternatives via OSRM...');
    let candidateRoutes: CandidateRoute[];
    try {
      candidateRoutes = await fetchCandidateRoutes(start, destination);
    } catch (err) {
      console.error('[/api/analyze] Routing error:', err instanceof Error ? err.message : String(err));
      res.status(422).json({
        error: true,
        message: err instanceof Error && err.message.includes('No suitable route')
          ? 'No suitable road route could be found between these locations.'
          : 'Could not calculate road routes between these locations. Please verify the addresses.',
      });
      return;
    }

    // Apply hard candidate routes budget
    const routesToAnalyze = candidateRoutes.slice(0, CONFIG.fortyguard.budgets.maxCandidateRoutes);
    console.info(`[/api/analyze] Evaluating ${routesToAnalyze.length} candidate route(s)`);

    // 3. Determine Analysis Date and Time (Single-Hour Mode filter_type: 1)
    const defaultDateTime = getDefaultAnalysisDateTime();
    const analysisDate = parseResult.data.date || defaultDateTime.date;
    const analysisTime = parseResult.data.time || defaultDateTime.time;

    // 4. FortyGuard Thermal Analysis for each candidate corridor
    // Hard upper-bound budget per analysis (MAX_FORTYGUARD_REQUESTS_PER_ANALYSIS)
    const budgetTracker = new AnalysisRequestBudget(CONFIG.fortyguard.budgets.maxTotalRequestsPerAnalysis);
    const routeMetrics: RouteMetrics[] = [];
    const failedRoutes: string[] = [];

    for (let i = 0; i < routesToAnalyze.length; i++) {
      const route = routesToAnalyze[i];
      try {
        console.info(`[/api/analyze] Generating corridor polygon for ${route.name} (${route.id})...`);
        const polygonAoi = buildCorridorPolygon(route.geometry);

        console.info(`[/api/analyze] Calling FortyGuard single-hour heatmap for ${route.id}...`);
        const observation = await analyseCorridorHeat(polygonAoi, analysisDate, analysisTime, budgetTracker);

        routeMetrics.push({
          routeId: route.id,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          observation,
        });
      } catch (err) {
        console.warn(
          `[/api/analyze] Route ${route.id} analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        failedRoutes.push(route.id);
      }
    }

    if (routeMetrics.length === 0) {
      throw new FortyGuardError(
        'Could not retrieve thermal intelligence for any of the candidate routes.',
        'TASK_FAILED',
        502,
      );
    }

    // 5. Scoring & Ranking Engine
    const scored = scoreRoutes(routeMetrics);
    const { ranked, recommendation } = rankRoutes(scored, routesToAnalyze);

    // 6. Assemble Response
    const candidateMap = new Map(routesToAnalyze.map((r) => [r.id, r]));

    const formattedTime = `${analysisTime} (${formatHourAmPm(analysisTime)})`;

    const mappedRoutes = ranked.map((r) => {
      const candidate = candidateMap.get(r.routeId)!;
      return {
        id: r.routeId,
        name: r.name,
        rank: r.rank,
        recommended: r.recommended,
        comparisonAvailable: r.comparisonAvailable,
        heatScore: r.heatScore,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        avgTemperatureCelsius: Math.round(r.observation.avgTemperatureCelsius * 10) / 10,
        maxTemperatureCelsius: Math.round(r.observation.maxTemperatureCelsius * 10) / 10,
        minTemperatureCelsius: Math.round(r.observation.minTemperatureCelsius * 10) / 10,
        tileCount: r.observation.tileCount,
        activityId: r.observation.activityId,
        geometry: candidate.geometry,
        components: r.components,
      };
    });

    const response: AnalyzeResponse = {
      routes: mappedRoutes,
      rankedRoutes: mappedRoutes,
      ranked_routes: mappedRoutes,
      recommendation,
      heatStatistics: mappedRoutes.map((r) => ({
        routeId: r.id,
        mean: r.avgTemperatureCelsius,
        maximum: r.maxTemperatureCelsius,
        minimum: r.minTemperatureCelsius,
        tileCount: r.tileCount,
      })),
      heat_statistics: mappedRoutes.map((r) => ({
        route_id: r.id,
        mean: r.avgTemperatureCelsius,
        maximum: r.maxTemperatureCelsius,
        minimum: r.minTemperatureCelsius,
        tile_count: r.tileCount,
      })),
      analysisTime: {
        date: analysisDate,
        time: analysisTime,
        formatted: formattedTime,
      },
    };

    console.info(
      `[/api/analyze] Analysis completed in ${Date.now() - startMs}ms. Comparison: ${recommendation.comparisonAvailable ? 'Multi-Route' : 'Single-Route'}. Result: ${recommendation.routeName || ranked[0].name} (${ranked[0].heatScore !== null ? `Score: ${ranked[0].heatScore}/100` : 'Single Route - No Score'})`,
    );

    res.status(200).json(response);
  } catch (err) {
    console.error('[/api/analyze] Pipeline error:', err);
    const userMessage = toUserFacingMessage(err);
    const statusCode = err instanceof FortyGuardError ? err.statusCode : 500;
    res.status(statusCode).json({ error: true, message: userMessage });
  } finally {
    activeAnalysesCount--;
  }
});

function formatHourAmPm(timeStr: string): string {
  const [hourStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
}

export default router;
