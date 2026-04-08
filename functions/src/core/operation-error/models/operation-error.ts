export enum JobErrorCategory {
  Functional = 'functional',
  Technical = 'technical',
  Partial = 'partial',
}

export type JobErrorDetails = Readonly<Record<string, unknown>>;

export type TransferJobErrorOptions = Readonly<{
  category: JobErrorCategory;
  code: string;
  retriable: boolean;
  details?: JobErrorDetails;
  cause?: unknown;
}>;

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

  public static isInstance(error: unknown): error is TransferJobError {
    return error instanceof TransferJobError;
  }
}
