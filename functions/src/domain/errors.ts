export const jobErrorCategories = [
  'functional',
  'technical',
  'partial',
] as const;

export type JobErrorCategory = (typeof jobErrorCategories)[number];

export interface JobErrorDetails {
  readonly [key: string]: unknown;
}

export interface TransferJobErrorOptions {
  readonly category: JobErrorCategory;
  readonly code: string;
  readonly retriable: boolean;
  readonly details?: JobErrorDetails;
  readonly cause?: unknown;
}

export class TransferJobError extends Error {
  public readonly category: JobErrorCategory;
  public readonly code: string;
  public readonly retriable: boolean;
  public readonly details: JobErrorDetails | undefined;
  public override readonly cause: unknown;

  public constructor(message: string, options: TransferJobErrorOptions) {
    super(message);

    this.name = 'TransferJobError';
    this.category = options.category;
    this.code = options.code;
    this.retriable = options.retriable;
    this.details = options.details;
    this.cause = options.cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface TransferJobErrorFallback {
  readonly category: JobErrorCategory;
  readonly code: string;
  readonly details?: JobErrorDetails;
  readonly message: string;
  readonly retriable: boolean;
}

export const isTransferJobError = (error: unknown): error is TransferJobError =>
  error instanceof TransferJobError;

export const toTransferJobError = (
  error: unknown,
  fallback: TransferJobErrorFallback,
): TransferJobError => {
  if (isTransferJobError(error)) {
    return error;
  }

  const options: TransferJobErrorOptions = {
    category: fallback.category,
    code: fallback.code,
    retriable: fallback.retriable,
    ...(fallback.details === undefined
      ? {}
      : {
          details: fallback.details,
        }),
    ...(error === undefined
      ? {}
      : {
          cause: error,
        }),
  };

  return new TransferJobError(fallback.message, options);
};
