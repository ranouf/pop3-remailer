import type { App } from 'firebase-admin/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirebaseAuthTokenVerifier } from '../../../../src/infrastructure/firebase/firebase-auth-token-verifier';

const { getAuthMock, verifyIdTokenMock } = vi.hoisted(() => {
  const hoistedVerifyIdTokenMock = vi.fn();
  const hoistedGetAuthMock = vi.fn(() => ({
    verifyIdToken: hoistedVerifyIdTokenMock,
  }));

  return {
    getAuthMock: hoistedGetAuthMock,
    verifyIdTokenMock: hoistedVerifyIdTokenMock,
  };
});

vi.mock('firebase-admin/auth', () => ({
  getAuth: getAuthMock,
}));

describe('infrastructure/firebase/firebase-auth-token-verifier', () => {
  beforeEach(() => {
    getAuthMock.mockClear();
    verifyIdTokenMock.mockReset();
  });

  it('returns the uid and email from the decoded token', async () => {
    verifyIdTokenMock.mockResolvedValue({
      email: 'cedric@carnould.com',
      uid: 'user-1',
    });

    const firebaseApp = {} as App;
    const verifier = new FirebaseAuthTokenVerifier(firebaseApp);

    await expect(verifier.verifyIdToken('firebase-id-token')).resolves.toEqual({
      email: 'cedric@carnould.com',
      uid: 'user-1',
    });
    expect(getAuthMock).toHaveBeenCalledWith(firebaseApp);
    expect(verifyIdTokenMock).toHaveBeenCalledWith('firebase-id-token');
  });

  it('omits the email when the decoded token does not contain one', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'user-2',
    });

    const verifier = new FirebaseAuthTokenVerifier({} as App);

    await expect(verifier.verifyIdToken('firebase-id-token')).resolves.toEqual({
      uid: 'user-2',
    });
  });
});
