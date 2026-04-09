import {
  JobErrorCategory,
  OperationErrorHelper,
  TransferJobError,
} from '../../../src/core/operation-error';

describe('domain/operation-error', () => {
  it('exposes the supported error categories', () => {
    expect(Object.values(JobErrorCategory)).toEqual([
      JobErrorCategory.Functional,
      JobErrorCategory.Technical,
      JobErrorCategory.Partial,
    ]);
  });

  it('creates a typed transfer job error', () => {
    const error = new TransferJobError('Boom', {
      category: JobErrorCategory.Technical,
      code: 'NETWORK_FAILURE',
      retriable: true,
      details: {
        provider: 'gmail',
      },
      cause: new Error('socket hang up'),
    });

    expect(error.name).toBe('TransferJobError');
    expect(error.message).toBe('Boom');
    expect(error.category).toBe(JobErrorCategory.Technical);
    expect(error.code).toBe('NETWORK_FAILURE');
    expect(error.retriable).toBe(true);
    expect(error.details).toEqual({ provider: 'gmail' });
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('keeps an existing transfer job error untouched', () => {
    const error = new TransferJobError('Existing', {
      category: JobErrorCategory.Functional,
      code: 'INVALID_UIDL',
      retriable: false,
    });

    expect(
      OperationErrorHelper.create(error, {
        category: JobErrorCategory.Technical,
        code: 'SHOULD_NOT_BE_USED',
        message: 'Fallback',
        retriable: true,
      }),
    ).toBe(error);
  });

  it('wraps unknown errors with a fallback definition', () => {
    const wrappedError = OperationErrorHelper.create('boom', {
      category: JobErrorCategory.Partial,
      code: 'EMAIL_TRANSFER_FAILED',
      message: 'Email transfer failed.',
      retriable: true,
      details: {
        provider: 'orange',
      },
    });

    expect(TransferJobError.isInstance(wrappedError)).toBe(true);
    expect(wrappedError.message).toBe('Email transfer failed.');
    expect(wrappedError.category).toBe(JobErrorCategory.Partial);
    expect(wrappedError.code).toBe('EMAIL_TRANSFER_FAILED');
    expect(wrappedError.retriable).toBe(true);
    expect(wrappedError.cause).toBe('boom');
  });

  it('omits optional fields when the fallback has no details and no cause', () => {
    const wrappedError = OperationErrorHelper.create(undefined, {
      category: JobErrorCategory.Technical,
      code: 'POP3_CONNECTION_FAILED',
      message: 'POP3 connection failed.',
      retriable: true,
    });

    expect(wrappedError.details).toBeUndefined();
    expect(wrappedError.cause).toBeUndefined();
  });
});
