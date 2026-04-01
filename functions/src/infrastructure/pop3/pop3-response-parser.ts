import { createUidl } from '../../domain/uidl';
import type { ParsedPop3ListEntry } from './models/parsed-pop3-list-entry';

export class Pop3ResponseParser {
  public parseListEntries(
    response: string[][] | string[],
  ): readonly ParsedPop3ListEntry[] {
    if (response.length === 0) {
      return [];
    }

    if (typeof response[0] === 'string') {
      return [this.parseSingleEntry(response as string[])];
    }

    return (response as string[][]).map((entry) => this.parsePairEntry(entry));
  }

  public parseListSizeEntry(response: string[][] | string[]): {
    readonly messageNumber: number;
    readonly messageSize: number;
  } {
    const entries = this.parseListEntries(response);

    if (entries.length !== 1) {
      throw new Error('Expected a single LIST entry from POP3.');
    }

    const entry = entries[0];

    if (entry === undefined) {
      throw new Error('Expected a single LIST entry from POP3.');
    }

    const parsedSize = Number.parseInt(entry.value, 10);

    if (!Number.isInteger(parsedSize) || parsedSize < 0) {
      throw new Error(`Invalid POP3 message size: ${entry.value}`);
    }

    return {
      messageNumber: entry.messageNumber,
      messageSize: parsedSize,
    };
  }

  public parseUidlEntry(response: string[][] | string[]): {
    readonly messageNumber: number;
    readonly uidl: ReturnType<typeof createUidl>;
  } {
    const entries = this.parseListEntries(response);

    if (entries.length !== 1) {
      throw new Error('Expected a single UIDL entry from POP3.');
    }

    const entry = entries[0];

    if (entry === undefined) {
      throw new Error('Expected a single UIDL entry from POP3.');
    }

    return {
      messageNumber: entry.messageNumber,
      uidl: createUidl(entry.value),
    };
  }

  private parseMessageNumber(value: string): number {
    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new Error(`Invalid POP3 message number: ${value}`);
    }

    return parsedValue;
  }

  private parsePairEntry(entry: readonly string[]): ParsedPop3ListEntry {
    if (entry.length < 2) {
      throw new Error('Invalid POP3 multi-line response entry.');
    }

    return {
      messageNumber: this.parseMessageNumber(entry[0] ?? ''),
      value: (entry[1] ?? '').trim(),
    };
  }

  private parseSingleEntry(entry: readonly string[]): ParsedPop3ListEntry {
    if (entry.length < 2) {
      throw new Error('Invalid POP3 single-line response entry.');
    }

    return {
      messageNumber: this.parseMessageNumber(entry[0] ?? ''),
      value: (entry[1] ?? '').trim(),
    };
  }
}
