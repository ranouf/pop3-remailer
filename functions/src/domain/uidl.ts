import { TransferJobError } from './errors';

const UIDL_PATTERN = /^[\x21-\x7E]{1,70}$/u;

export type Uidl = string & { readonly __brand: 'Uidl' };

export const normalizeUidl = (value: string): string => value.trim();

export const isValidUidl = (value: string): value is Uidl =>
  UIDL_PATTERN.test(normalizeUidl(value));

export const createUidl = (value: string): Uidl => {
  const normalizedValue = normalizeUidl(value);

  if (!UIDL_PATTERN.test(normalizedValue)) {
    throw new TransferJobError('Invalid POP3 UIDL.', {
      category: 'functional',
      code: 'INVALID_UIDL',
      retriable: false,
      details: {
        value,
      },
    });
  }

  return normalizedValue as Uidl;
};
