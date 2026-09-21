import { TransferJobError } from '../../../src/core/operation-error';
import { Uidl } from '../../../src/core/email/uidl';

describe('domain/uidl', () => {
  it('normalizes and creates a valid UIDL', () => {
    expect(Uidl.normalize('  abc-123  ')).toBe('abc-123');
    expect(Uidl.create('  abc-123  ').toString()).toBe('abc-123');
  });

  it('accepts UIDLs that respect POP3 printable ASCII constraints', () => {
    expect(Uidl.isValid('abcDEF123-_.~')).toBe(true);
  });

  it('rejects UIDLs that contain whitespace in the identifier', () => {
    expect(Uidl.isValid('abc def')).toBe(false);
  });

  it('rejects invalid UIDLs with a functional error', () => {
    expect(() => Uidl.create('')).toThrowError(TransferJobError);
    expect(() => Uidl.create('a'.repeat(71))).toThrowError(TransferJobError);
  });
});
