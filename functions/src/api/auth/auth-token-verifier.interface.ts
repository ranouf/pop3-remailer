import type { AuthenticatedUser } from './authenticated-user';

export interface AuthTokenVerifierInterface {
  verifyIdToken(idToken: string): Promise<AuthenticatedUser>;
}
