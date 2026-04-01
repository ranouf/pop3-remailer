import { setTimeout as delay } from 'node:timers/promises';

import {
  toTransferJobError,
  type TransferJobErrorFallback,
} from '../domain/errors';

export interface RetryPolicy {
  readonly backoffMultiplier: number;
  readonly initialDelayMs: number;
  readonly maxAttempts: number;
  readonly maxDelayMs: number;
}

export interface RetryContext {
  readonly attempt: number;
  readonly maxAttempts: number;
}

export interface RetryOptions {
  readonly fallbackError: TransferJobErrorFallback;
  readonly isRetryable?: (error: unknown) => boolean;
  readonly policy: RetryPolicy;
}

export const defaultRetryPolicy: RetryPolicy = {
  backoffMultiplier: 2,
  initialDelayMs: 250,
  maxAttempts: 3,
  maxDelayMs: 2000,
};

export const calculateRetryDelayMs = (
  policy: RetryPolicy,
  attempt: number,
): number => {
  if (!Number.isInteger(attempt) || attempt < 1) {
    return 0;
  }

  const exponentialDelay =
    policy.initialDelayMs * policy.backoffMultiplier ** (attempt - 1);

  return Math.min(policy.maxDelayMs, exponentialDelay);
};

export const retry = async <T>(
  operation: (context: RetryContext) => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const maxAttempts = options.policy.maxAttempts;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation({
        attempt,
        maxAttempts,
      });
    } catch (error) {
      const normalizedError = toTransferJobError(error, options.fallbackError);
      const canRetry =
        attempt < maxAttempts &&
        normalizedError.retriable &&
        (options.isRetryable?.(normalizedError) ?? true);

      if (!canRetry) {
        throw normalizedError;
      }

      await delay(calculateRetryDelayMs(options.policy, attempt));
    }
  }

  throw toTransferJobError(undefined, options.fallbackError);
};
