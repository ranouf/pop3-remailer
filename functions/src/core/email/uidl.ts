import { JobErrorCategory, TransferJobError } from '../operation-error';

export class Uidl {
  private static readonly pattern = /^[\x21-\x7E]{1,70}$/u;

  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): Uidl {
    const normalizedValue = Uidl.normalize(value);

    if (!Uidl.pattern.test(normalizedValue)) {
      throw new TransferJobError('Invalid POP3 UIDL.', {
        category: JobErrorCategory.Functional,
        code: 'INVALID_UIDL',
        retriable: false,
        details: {
          value,
        },
      });
    }

    return new Uidl(normalizedValue);
  }

  public static isValid(value: string): boolean {
    return Uidl.pattern.test(Uidl.normalize(value));
  }

  public static normalize(value: string): string {
    return value.trim();
  }

  public equals(other: Uidl): boolean {
    return this.value === other.value;
  }

  public toJSON(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }

  public valueOf(): string {
    return this.value;
  }
}
