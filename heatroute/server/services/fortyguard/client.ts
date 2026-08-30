/**
 * FortyGuard API Client (Server-side Only).
 *
 * Handles authenticated communication with FortyGuard REST endpoints:
 * - Secret key management (never sent to client)
 * - Heatmap submission (POST /v1/heatmap)
 * - Bounded status polling (GET /v1/status/{activity_id})
 * - Exponential backoff retries for transient errors
 * - Hard request budget tracking per analysis (MAX_FORTYGUARD_REQUESTS_PER_ANALYSIS)
 */

import { CONFIG } from '@server/config';
import {
  FortyGuardError,
  FortyGuardAuthError,
  FortyGuardRateLimitError,
  FortyGuardBudgetExceededError,
  FortyGuardTaskTimeoutError,
  FortyGuardTaskFailedError,
} from './errors';
import { parseHeatmapResult } from './parser';
import type {
  RawSubmissionResponse,
  RawStatusResponse,
  RawHeatmapRequest,
  HeatObservation,
} from './types';

/**
 * Hard upper-bound request budget tracker for a single analysis run.
 * Ensures cumulative FortyGuard HTTP calls (submissions + status polls) cannot exceed configured limits.
 */
export class AnalysisRequestBudget {
  private count = 0;
  private maxRequests: number;

  constructor(maxRequests: number = CONFIG.fortyguard.budgets.maxTotalRequestsPerAnalysis) {
    this.maxRequests = maxRequests;
  }

  public recordRequest(): void {
    this.count++;
    if (this.count > this.maxRequests) {
      throw new FortyGuardBudgetExceededError(
        `FortyGuard request budget exceeded (${this.count} > ${this.maxRequests} requests). Aborting further API requests to prevent runaway consumption.`,
      );
    }
  }

  public get totalRequests(): number {
    return this.count;
  }

  public get limit(): number {
    return this.maxRequests;
  }
}

function getApiKey(): string {
  const key = process.env.FORTYGUARD_API_KEY;
  if (!key || key.trim() === '') {
    throw new FortyGuardAuthError();
  }
  return key.trim();
}

function buildHeaders(): HeadersInit {
  return {
    'api-key': getApiKey(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = CONFIG.fortyguard.requestTimeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = CONFIG.fortyguard.maxRetries,
  budget?: AnalysisRequestBudget,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Record every physical request towards the per-analysis hard budget
    if (budget) {
      budget.recordRequest();
    }

    try {
      const response = await fetchWithTimeout(url, options);

      // Handle non-retryable 4xx codes immediately
      if (response.status === 401 || response.status === 403) {
        throw new FortyGuardAuthError();
      }
      if (response.status === 429) {
        throw new FortyGuardRateLimitError();
      }
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text().catch(() => '');
        throw new FortyGuardError(
          `FortyGuard API rejected request (HTTP ${response.status}): ${errorText}`,
          'INVALID_REQUEST',
          response.status,
        );
      }

      return response;
    } catch (err) {
      if (
        err instanceof FortyGuardAuthError ||
        err instanceof FortyGuardRateLimitError ||
        err instanceof FortyGuardBudgetExceededError ||
        (err instanceof FortyGuardError && err.code === 'INVALID_REQUEST')
      ) {
        throw err;
      }

      lastError = err;
      if (attempt < maxRetries) {
        const delay = CONFIG.fortyguard.retryBackoffMs * Math.pow(2, attempt);
        console.warn(`[FortyGuard] Transient network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new FortyGuardError(
    `FortyGuard request failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    'NETWORK_ERROR',
  );
}

/**
 * Submits a heatmap task to FortyGuard and returns the activity_id.
 */
async function submitHeatmap(
  request: RawHeatmapRequest,
  budget?: AnalysisRequestBudget,
): Promise<string> {
  const url = `${CONFIG.fortyguard.baseUrl}/v1/heatmap`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(request),
    },
    CONFIG.fortyguard.maxRetries,
    budget,
  );

  const data = (await response.json()) as RawSubmissionResponse;

  if (data.error || !data.data?.activity_id) {
    throw new FortyGuardError(
      data.message || 'FortyGuard submission response missing activity_id.',
      'PARSE_ERROR',
    );
  }

  return data.data.activity_id;
}

/**
 * Polls GET /v1/status/{activity_id} until completion, failure, or timeout.
 */
async function pollUntilComplete(
  activityId: string,
  budget?: AnalysisRequestBudget,
): Promise<RawStatusResponse> {
  const url = `${CONFIG.fortyguard.baseUrl}/v1/status/${encodeURIComponent(activityId)}`;
  const deadline = Date.now() + CONFIG.fortyguard.maxPollMs;
  let cycle = 0;

  while (Date.now() < deadline && cycle < CONFIG.fortyguard.maxPollCycles) {
    cycle++;

    const response = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: buildHeaders(),
      },
      CONFIG.fortyguard.maxRetries,
      budget,
    );

    const json = (await response.json()) as RawStatusResponse;
    const status = json.data?.status;

    console.info(`[FortyGuard] Activity ${activityId} poll cycle ${cycle}: Status = ${status}`);

    if (status === 'Completed') {
      return json;
    }

    if (status === 'Failed') {
      throw new FortyGuardTaskFailedError(activityId);
    }

    // Status is 'Processing' — wait before polling again
    await sleep(CONFIG.fortyguard.pollIntervalMs);
  }

  throw new FortyGuardTaskTimeoutError(activityId);
}

/**
 * High-level service: Submits a route corridor polygon to FortyGuard and polls for thermal results.
 * Supports Single-Hour mode (filter_type: 1) with specific start_date and start_time.
 * Enforces per-analysis request budget.
 */
export async function analyseCorridorHeat(
  polygonAoi: RawHeatmapRequest['polygon_aoi'],
  startDate: string,
  startTime: string = '14:00',
  budget?: AnalysisRequestBudget,
): Promise<HeatObservation> {
  const startMs = Date.now();

  const requestPayload: RawHeatmapRequest = {
    polygon_aoi: polygonAoi,
    date_time: {
      start_date: startDate,
      start_time: startTime,
      filter_type: CONFIG.fortyguard.filterType,
    },
    granularity: CONFIG.fortyguard.granularity,
    analytic_type: CONFIG.fortyguard.analyticType,
  };

  console.info(`[FortyGuard] Submitting single-hour corridor heatmap for ${startDate} at ${startTime}`);
  const activityId = await submitHeatmap(requestPayload, budget);
  const statusResponse = await pollUntilComplete(activityId, budget);
  const observation = parseHeatmapResult(statusResponse, activityId);

  console.info(
    `[FortyGuard] Analysis finished in ${Date.now() - startMs}ms: ` +
    `Mean=${observation.avgTemperatureCelsius.toFixed(1)}°C, ` +
    `Max=${observation.maxTemperatureCelsius.toFixed(1)}°C, ` +
    `Tiles=${observation.tileCount}`,
  );

  return observation;
}
