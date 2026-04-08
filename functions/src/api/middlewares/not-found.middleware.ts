import type { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { ErrorResponseDto } from '../dtos';

export function notFoundMiddleware(
  _request: Request,
  response: Response,
): void {
  response
    .status(StatusCodes.NOT_FOUND)
    .json(ErrorResponseDto.fromMessage(ReasonPhrases.NOT_FOUND));
}
