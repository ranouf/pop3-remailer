import type { NextFunction, Request, Response } from 'express';
import { isHttpError } from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import type { StructuredLogger } from '../../core/logging/structured-logger.interface';
import { ErrorResponseDto } from '../dtos';

export function createUnexpectedErrorMiddleware(logger: StructuredLogger) {
  return (
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    void next;

    if (isHttpError(error)) {
      if (error.statusCode === 403) {
        logger.warn('Operations API request rejected.', {
          error: error.message,
          path: request.path,
        });
      }

      response
        .status(error.statusCode)
        .json(
          ErrorResponseDto.fromMessage(
            error.statusCode === 401
              ? ReasonPhrases.UNAUTHORIZED
              : error.statusCode === 403
                ? ReasonPhrases.FORBIDDEN
                : error.message,
          ),
        );
      return;
    }

    if (error instanceof Error && error.name === 'ValidateError') {
      response
        .status(StatusCodes.UNPROCESSABLE_ENTITY)
        .json(
          ErrorResponseDto.fromMessage(
            error.message.length === 0 ? 'Validation failed.' : error.message,
          ),
        );
      return;
    }

    logger.error('Operations API request failed.', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.path,
    });
    response
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json(ErrorResponseDto.fromMessage(ReasonPhrases.INTERNAL_SERVER_ERROR));
  };
}
