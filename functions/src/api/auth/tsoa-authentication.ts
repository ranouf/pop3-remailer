import type { Request } from 'express';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import type { AuthenticatedUser } from './authenticated-user';
import { ApiRuntimeContext } from '../runtime/api-runtime';

export async function expressAuthentication(
  request: Request,
  securityName: string,
): Promise<AuthenticatedUser> {
  if (securityName !== 'firebaseBearerAuth') {
    throw createHttpError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Unsupported security definition.',
    );
  }

  const token = readBearerToken(request.header('authorization'));

  if (token === null) {
    throw createHttpError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
  }

  try {
    const runtime = ApiRuntimeContext.read(request);
    const authenticatedUser =
      await runtime.authTokenVerifier.verifyIdToken(token);
    const authorizedUserEmail =
      runtime.configuration.gmail.userEmail.toLowerCase();
    const authenticatedEmail = authenticatedUser.email?.toLowerCase();

    if (authenticatedEmail !== authorizedUserEmail) {
      throw createHttpError(StatusCodes.FORBIDDEN, ReasonPhrases.FORBIDDEN);
    }

    return authenticatedUser;
  } catch {
    throw createHttpError(StatusCodes.FORBIDDEN, ReasonPhrases.FORBIDDEN);
  }
}

function readBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (authorizationHeader === undefined) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || token === undefined || token.length === 0) {
    return null;
  }

  return token;
}
