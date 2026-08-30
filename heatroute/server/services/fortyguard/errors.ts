/**
 * Typed error classes for FortyGuard API integration and route analysis.
 * Internal secrets, stack traces, and raw keys are never leaked to clients.
 */

export type ErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'BUDGET_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_REGION'
  | 'TASK_FAILED'
  | 'TASK_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'MISSING_RESULT'
  | 'ROUTING_FAILED';

export class FortyGuardError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'FortyGuardError';
  }
}

export class FortyGuardAuthError extends FortyGuardError {
  constructor() {
    super('FortyGuard authentication failed. Please verify FORTYGUARD_API_KEY.', 'AUTH_ERROR', 401);
  }
}

export class FortyGuardRateLimitError extends FortyGuardError {
  constructor() {
    super('FortyGuard rate limit exceeded. Please try again shortly.', 'RATE_LIMIT', 429);
  }
}

export class FortyGuardBudgetExceededError extends FortyGuardError {
  constructor(message: string) {
    super(message, 'BUDGET_EXCEEDED', 429);
  }
}

export class UnsupportedRegionError extends FortyGuardError {
  constructor(locationName?: string) {
    super(
      locationName
        ? `Location '${locationName}' is outside the supported United States / Alabama region.`
        : 'The requested location is outside the supported United States / Alabama region.',
      'UNSUPPORTED_REGION',
      422,
    );
  }
}

export class FortyGuardTaskTimeoutError extends FortyGuardError {
  constructor(activityId: string) {
    super(`FortyGuard activity '${activityId}' timed out before completion.`, 'TASK_TIMEOUT', 504);
  }
}

export class FortyGuardTaskFailedError extends FortyGuardError {
  constructor(activityId: string) {
    super(`FortyGuard activity '${activityId}' processing failed on the server.`, 'TASK_FAILED', 502);
  }
}

/**
 * Maps any internal error to a clean, user-friendly string without leaking internal details.
 */
export function toUserFacingMessage(err: unknown): string {
  if (err instanceof UnsupportedRegionError) {
    return err.message;
  }
  if (err instanceof FortyGuardBudgetExceededError) {
    return 'Analysis request budget limit reached. Please wait a moment and try again.';
  }
  if (err instanceof FortyGuardAuthError) {
    return 'FortyGuard authentication failed. Please verify that FORTYGUARD_API_KEY is configured in Vercel Environment Variables.';
  }
  if (err instanceof FortyGuardRateLimitError) {
    return 'Too many heat analysis requests were submitted. Please wait a moment and retry.';
  }
  if (err instanceof FortyGuardTaskTimeoutError) {
    return 'Heat analysis timed out. Please try again or select a slightly shorter route.';
  }
  if (err instanceof FortyGuardTaskFailedError) {
    return 'Heat intelligence analysis could not be completed for this route corridor.';
  }
  if (err instanceof FortyGuardError) {
    return err.message || 'We were unable to retrieve heat intelligence for this route at this time.';
  }
  if (err instanceof Error) {
    if (err.message.includes('No suitable route')) {
      return 'No suitable road route could be found between the chosen locations.';
    }
    return err.message;
  }
  return 'An unexpected error occurred during route heat analysis. Please try again.';
}
