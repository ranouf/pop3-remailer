import type { AuthTokenVerifierInterface } from '../../../../src/api/auth/auth-token-verifier.interface';

export class FakeApiAuthTokenVerifier implements AuthTokenVerifierInterface {
  public readonly tokens: string[] = [];

  public constructor(
    private readonly shouldReject = false,
    private readonly email = 'destination@gmail.com',
  ) {}

  public verifyIdToken(token: string): Promise<{
    readonly email: string;
    readonly uid: string;
  }> {
    this.tokens.push(token);

    if (this.shouldReject) {
      return Promise.reject(new Error('Invalid token'));
    }

    return Promise.resolve({
      email: this.email,
      uid: 'integration-user',
    });
  }
}
