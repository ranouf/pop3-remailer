import { describe, expect, it } from 'vitest';

import {
  SourceAccount,
  SourceProvider,
} from '../../../src/jobs/email-transfer/models/source-account';

describe('unit/transfer-email/source-account', () => {
  it('creates a normalized source account id', () => {
    expect(
      SourceAccount.createId(SourceProvider.Orange, ' Source@Orange.fr '),
    ).toBe('orange:source@orange.fr');
  });

  it('stores the provided values', () => {
    const sourceAccount = new SourceAccount(
      'source@orange.fr',
      'orange:source@orange.fr',
      SourceProvider.Orange,
      'source@orange.fr',
    );

    expect(sourceAccount.address).toBe('source@orange.fr');
    expect(sourceAccount.id).toBe('orange:source@orange.fr');
    expect(sourceAccount.provider).toBe(SourceProvider.Orange);
    expect(sourceAccount.username).toBe('source@orange.fr');
  });
});
