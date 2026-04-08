import {
  TransferJobError,
  type JobErrorCategory,
  type JobErrorDetails,
  type TransferJobErrorOptions,
} from './models';

export type OperationErrorFallback = Readonly<{
  category: JobErrorCategory;
  code: string;
  details?: JobErrorDetails;
  message: string;
  retriable: boolean;
}>;

export class OperationErrorHelper {
  public static create(
    error: unknown,
    fallback: OperationErrorFallback,
  ): TransferJobError {
    if (TransferJobError.isInstance(error)) {
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
  }
}
