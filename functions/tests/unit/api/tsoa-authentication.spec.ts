import { describe, expect, it, vi } from 'vitest';

import { ApiRuntimeContext } from '../../../src/api/runtime/api-runtime';
import { expressAuthentication } from '../../../src/api/auth/tsoa-authentication';
import { testApplicationConfiguration } from '../../integration/api/configuration/test-application-configuration';

const createRequest = (
  authorizationHeader?: string,
  verifyIdToken:
    | ((
        token: string,
      ) => Promise<{ readonly email?: string; readonly uid: string }>)
    | undefined = undefined,
) =>
  ({
    app: {
      locals:
        verifyIdToken === undefined
          ? {}
          : {
              operationsApiRuntime: ApiRuntimeContext.create(
                {
                  verifyIdToken,
                },
                testApplicationConfiguration,
                {} as never,
                {} as never,
                {} as never,
              ),
            },
    },
    header(name: string): string | undefined {
      return name === 'authorization' ? authorizationHeader : undefined;
    },
  }) as never;

describe('unit/api/tsoa-authentication', () => {
  it('rejects unsupported security definitions', async () => {
    await expect(
      expressAuthentication(createRequest('Bearer token'), 'unsupported'),
    ).rejects.toMatchObject({
      message: 'Unsupported security definition.',
      statusCode: 500,
    });
  });

  it('rejects malformed bearer headers as unauthorized', async () => {
    await expect(
      expressAuthentication(createRequest('token'), 'firebaseBearerAuth'),
    ).rejects.toMatchObject({
      message: 'Unauthorized',
      statusCode: 401,
    });
  });

  it('delegates token verification to the runtime auth verifier', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      email: 'destination@gmail.com',
      uid: 'user-1',
    });

    const authenticatedUser = await expressAuthentication(
      createRequest('Bearer token', verifyIdToken),
      'firebaseBearerAuth',
    );

    expect(verifyIdToken).toHaveBeenCalledWith('token');
    expect(authenticatedUser).toEqual({
      email: 'destination@gmail.com',
      uid: 'user-1',
    });
  });
});
