import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

import type { AuthTokenVerifierInterface } from '../../api/auth/auth-token-verifier.interface';

export class FirebaseAuthTokenVerifier implements AuthTokenVerifierInterface {
  private readonly firebaseApp: App;

  public constructor(firebaseApp: App) {
    this.firebaseApp = firebaseApp;
  }

  public async verifyIdToken(idToken: string): Promise<{
    readonly email?: string;
    readonly uid: string;
  }> {
    const decodedToken = await getAuth(this.firebaseApp).verifyIdToken(idToken);

    return this.toAuthenticatedUser(decodedToken);
  }

  private toAuthenticatedUser(decodedToken: DecodedIdToken): {
    readonly email?: string;
    readonly uid: string;
  } {
    return {
      ...(decodedToken.email === undefined
        ? {}
        : {
            email: decodedToken.email,
          }),
      uid: decodedToken.uid,
    };
  }
}
