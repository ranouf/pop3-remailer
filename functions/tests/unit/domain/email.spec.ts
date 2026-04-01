import {
  createSourceAccountId,
  emailRecordStatuses,
  isTerminalEmailRecordStatus,
  sourceProviders,
} from '../../../src/domain/email';

describe('domain/email', () => {
  it('exposes the supported source providers and statuses', () => {
    expect(sourceProviders).toEqual(['orange', 'wanadoo']);
    expect(emailRecordStatuses).toEqual(['processing', 'imported', 'failed']);
  });

  it('creates a deterministic source account identifier', () => {
    expect(createSourceAccountId('orange', '  User.Name@Orange.Fr  ')).toBe(
      'orange:user.name@orange.fr',
    );
  });

  it('knows which email statuses are terminal', () => {
    expect(isTerminalEmailRecordStatus('processing')).toBe(false);
    expect(isTerminalEmailRecordStatus('imported')).toBe(true);
    expect(isTerminalEmailRecordStatus('failed')).toBe(true);
  });
});
