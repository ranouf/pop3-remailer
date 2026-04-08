import { describe, expect, it } from 'vitest';

import { Pop3ResponseParser } from '../../../../src/infrastructure/email/node-pop3/parser/pop3-response-parser';

describe('infrastructure/pop3/pop3-response', () => {
  const parser = new Pop3ResponseParser();

  it('parses POP3 multi-line entries', () => {
    expect(
      parser.parseListEntries([
        ['1', '100'],
        ['2', '200'],
      ]),
    ).toEqual([
      {
        messageNumber: 1,
        value: '100',
      },
      {
        messageNumber: 2,
        value: '200',
      },
    ]);
  });

  it('parses a single POP3 UIDL entry', () => {
    const result = parser.parseUidlEntry(['7', 'uidl-007']);

    expect(result.messageNumber).toBe(7);
    expect(result.uidl.toString()).toBe('uidl-007');
  });

  it('parses a single POP3 LIST size entry', () => {
    expect(parser.parseListSizeEntry(['4', '512'])).toEqual({
      messageNumber: 4,
      messageSize: 512,
    });
  });

  it('rejects malformed POP3 entries', () => {
    expect(() => parser.parseListEntries([['1']])).toThrow(
      'Invalid POP3 multi-line response entry.',
    );
    expect(() => parser.parseListEntries(['0', 'uidl-000'])).toThrow(
      'Invalid POP3 message number: 0',
    );
    expect(() => parser.parseUidlEntry([])).toThrow(
      'Expected a single UIDL entry from POP3.',
    );
    expect(() =>
      parser.parseUidlEntry([
        ['1', 'uidl-001'],
        ['2', 'uidl-002'],
      ]),
    ).toThrow('Expected a single UIDL entry from POP3.');
    expect(() =>
      parser.parseListSizeEntry([
        ['1', '100'],
        ['2', '200'],
      ]),
    ).toThrow('Expected a single LIST entry from POP3.');
    expect(() => parser.parseListSizeEntry(['3', '-1'])).toThrow(
      'Invalid POP3 message size: -1',
    );
  });
});
