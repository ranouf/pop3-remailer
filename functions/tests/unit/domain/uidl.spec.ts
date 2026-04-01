import { TransferJobError } from '../../../src/domain/errors';
import {
  createUidl,
  isValidUidl,
  normalizeUidl,
} from '../../../src/domain/uidl';

describe('domain/uidl', () => {
  it('normalizes and creates a valid UIDL', () => {
    expect(normalizeUidl('  abc-123  ')).toBe('abc-123');
    expect(createUidl('  abc-123  ')).toBe('abc-123');
  });

  it('accepts UIDLs that respect POP3 printable ASCII constraints', () => {
    expect(isValidUidl('abcDEF123-_.~')).toBe(true);
  });

  it('rejects UIDLs that contain whitespace in the identifier', () => {
    expect(isValidUidl('abc def')).toBe(false);
  });

  it('rejects invalid UIDLs with a functional error', () => {
    expect(() => createUidl('')).toThrowError(TransferJobError);
    expect(() => createUidl('a'.repeat(71))).toThrowError(TransferJobError);
  });
});
