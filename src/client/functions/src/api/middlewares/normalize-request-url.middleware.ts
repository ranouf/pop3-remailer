import type { NextFunction, Request, Response } from 'express';

export function normalizeRequestUrlMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const trimmedUrl = request.url.trim();

  if (trimmedUrl === '/api') {
    request.url = '/';
    next();
    return;
  }

  if (trimmedUrl.startsWith('/api/')) {
    request.url = trimmedUrl.slice(4);
    next();
    return;
  }

  request.url = trimmedUrl;
  next();
}
