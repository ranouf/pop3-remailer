import { TransferJobError } from '../../../src/domain/errors';
import {
  calculateRetryDelayMs,
  defaultRetryPolicy,
  retry,
} from '../../../src/shared/retry';

describe('shared/retry', () => {
  it('calculates an exponential backoff delay capped by maxDelayMs', () => {
    expect(calculateRetryDelayMs(defaultRetryPolicy, 0)).toBe(0);
    expect(calculateRetryDelayMs(defaultRetryPolicy, 1)).toBe(250);
    expect(calculateRetryDelayMs(defaultRetryPolicy, 2)).toBe(500);
    expect(calculateRetryDelayMs(defaultRetryPolicy, 5)).toBe(2000);
  });

  it('retries a retriable failure and eventually succeeds', async () => {
    let attempts = 0;

    const result = await retry(
      () => {
        attempts += 1;

        if (attempts < 2) {
          throw new TransferJobError('Temporary failure', {
            category: 'technical',
            code: 'TEMPORARY_FAILURE',
            retriable: true,
          });
        }

        return Promise.resolve('ok');
      },
      {
        fallbackError: {
          category: 'technical',
          code: 'RETRY_EXHAUSTED',
          message: 'Retry exhausted.',
          retriable: true,
        },
        policy: {
          backoffMultiplier: 1,
          initialDelayMs: 0,
          maxAttempts: 3,
          maxDelayMs: 0,
        },
      },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws immediately for a non-retriable error', async () => {
    await expect(
      retry(
        () => {
          throw new TransferJobError('Permanent failure', {
            category: 'functional',
            code: 'PERMANENT_FAILURE',
            retriable: false,
          });
        },
        {
          fallbackError: {
            category: 'technical',
            code: 'RETRY_EXHAUSTED',
            message: 'Retry exhausted.',
            retriable: true,
          },
          policy: {
            backoffMultiplier: 1,
            initialDelayMs: 0,
            maxAttempts: 3,
            maxDelayMs: 0,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 'PERMANENT_FAILURE',
    });
  });

  it('stops retrying when the custom predicate rejects the error', async () => {
    let attempts = 0;

    await expect(
      retry(
        () => {
          attempts += 1;

          throw new TransferJobError('Temporary failure', {
            category: 'technical',
            code: 'TEMPORARY_FAILURE',
            retriable: true,
          });
        },
        {
          fallbackError: {
            category: 'technical',
            code: 'RETRY_EXHAUSTED',
            message: 'Retry exhausted.',
            retriable: true,
          },
          isRetryable: () => false,
          policy: {
            backoffMultiplier: 1,
            initialDelayMs: 0,
            maxAttempts: 3,
            maxDelayMs: 0,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 'TEMPORARY_FAILURE',
    });

    expect(attempts).toBe(1);
  });

  it('wraps unknown failures with the fallback error', async () => {
    const error = await retry(
      () => {
        throw new Error('network timeout');
      },
      {
        fallbackError: {
          category: 'technical',
          code: 'NETWORK_TIMEOUT',
          message: 'Network timeout.',
          retriable: true,
        },
        policy: {
          backoffMultiplier: 1,
          initialDelayMs: 0,
          maxAttempts: 2,
          maxDelayMs: 0,
        },
      },
    ).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);
    expect(error).toMatchObject({
      code: 'NETWORK_TIMEOUT',
    });

    if (!(error instanceof TransferJobError)) {
      throw new Error('Expected a TransferJobError instance.');
    }

    expect(error.cause).toBeInstanceOf(Error);

    if (!(error.cause instanceof Error)) {
      throw new Error('Expected the cause to be an Error instance.');
    }

    expect(error.cause.message).toBe('network timeout');
  });
});
