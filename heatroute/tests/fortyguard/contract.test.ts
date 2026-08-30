import { describe, it, expect } from 'vitest';
import type { RawSubmissionResponse, RawStatusResponse } from '@server/services/fortyguard/types';
import { parseHeatmapResult } from '@server/services/fortyguard/parser';
import { FortyGuardError } from '@server/services/fortyguard/errors';
import { AnalysisRequestBudget } from '@server/services/fortyguard/client';

describe('FortyGuard API Contract Tests', () => {
  it('validates submission response shape with activity_id', () => {
    const mockSubmission: RawSubmissionResponse = {
      error: false,
      status_code: 200,
      message: 'Heatmap Submitted Successfully',
      data: {
        activity_id: 'f52d2453-6a59-4b31-afa3-8fe3bb1ac5df',
      },
    };

    expect(mockSubmission.error).toBe(false);
    expect(mockSubmission.status_code).toBe(200);
    expect(typeof mockSubmission.data.activity_id).toBe('string');
    expect(mockSubmission.data.activity_id).toHaveLength(36);
  });

  it('validates Processing status response', () => {
    const mockProcessing: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Processing',
      data: {
        activity_id: 'f52d2453-6a59-4b31-afa3-8fe3bb1ac5df',
        status: 'Processing',
      },
    };

    expect(mockProcessing.data.status).toBe('Processing');
    expect(mockProcessing.data.result).toBeUndefined();
  });

  it('validates Completed status response with stats_data.Temperature_stats', () => {
    const mockCompleted: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Completed',
      data: {
        activity_id: 'f52d2453-6a59-4b31-afa3-8fe3bb1ac5df',
        status: 'Completed',
        result: {
          stats_data: {
            Temperature_stats: {
              Minimum: 28.5,
              Maximum: 39.2,
              Mean: 34.1,
              Standard_deviation: 2.1,
            },
          },
        },
      },
    };

    expect(mockCompleted.data.status).toBe('Completed');
    const observation = parseHeatmapResult(mockCompleted, mockCompleted.data.activity_id);
    expect(observation.avgTemperatureCelsius).toBe(34.1);
    expect(observation.maxTemperatureCelsius).toBe(39.2);
    expect(observation.minTemperatureCelsius).toBe(28.5);
    expect(observation.activityId).toBe('f52d2453-6a59-4b31-afa3-8fe3bb1ac5df');
  });

  it('handles Completed status response with lowercase temperature_stats', () => {
    const mockCompletedLower: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Completed',
      data: {
        activity_id: 'act-lower-123',
        status: 'Completed',
        result: {
          stats_data: {
            temperature_stats: {
              minimum: 25.0,
              maximum: 35.5,
              mean: 30.2,
              standard_deviation: 1.8,
            },
          },
        },
      },
    };

    const obs = parseHeatmapResult(mockCompletedLower, 'act-lower-123');
    expect(obs.avgTemperatureCelsius).toBe(30.2);
    expect(obs.maxTemperatureCelsius).toBe(35.5);
    expect(obs.minTemperatureCelsius).toBe(25.0);
  });

  it('throws FortyGuardError when result is missing in Completed status', () => {
    const mockEmptyResult: RawStatusResponse = {
      error: false,
      status_code: 200,
      message: 'Completed',
      data: {
        activity_id: 'act-empty',
        status: 'Completed',
      },
    };

    expect(() => parseHeatmapResult(mockEmptyResult, 'act-empty')).toThrow(FortyGuardError);
  });

  describe('AnalysisRequestBudget Enforcement', () => {
    it('allows requests within the configured budget limit', () => {
      const budget = new AnalysisRequestBudget(3);
      expect(() => {
        budget.recordRequest();
        budget.recordRequest();
        budget.recordRequest();
      }).not.toThrow();
      expect(budget.totalRequests).toBe(3);
    });

    it('strictly throws FortyGuardBudgetExceededError when request budget is exceeded', () => {
      const budget = new AnalysisRequestBudget(2);
      budget.recordRequest(); // 1st
      budget.recordRequest(); // 2nd (reaches limit)

      // 3rd attempt exceeds limit and must throw
      expect(() => budget.recordRequest()).toThrowError(/request budget exceeded/i);
    });
  });
});
