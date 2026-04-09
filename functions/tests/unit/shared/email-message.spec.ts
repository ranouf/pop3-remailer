import { EmailMessageHelper } from '../../../src/core/email';
import { encodeMessageForGmailImport } from '../../../src/infrastructure/email/gmail/helpers';

describe('email message helpers', () => {
  it('extracts the RFC822 message id from a raw email', () => {
    expect(
      EmailMessageHelper.extractRfc822MessageId(
        'From: source@example.com\r\nMessage-ID: <abc123@example.com>\r\n\r\nBody',
      ),
    ).toBe('abc123@example.com');
  });

  it('returns the raw message id header value when angle brackets are missing', () => {
    expect(
      EmailMessageHelper.extractRfc822MessageId(
        'From: source@example.com\r\nMessage-ID: abc123@example.com\r\n\r\nBody',
      ),
    ).toBe('abc123@example.com');
  });

  it('returns null when the message id header is absent', () => {
    expect(
      EmailMessageHelper.extractRfc822MessageId(
        'From: source@example.com\r\n\r\nBody',
      ),
    ).toBe(null);
  });

  it('encodes a message using base64url for Gmail import', () => {
    expect(encodeMessageForGmailImport('Hello+/=')).toBe('SGVsbG8rLz0');
  });

  it('computes the message size in bytes', () => {
    expect(EmailMessageHelper.getMessageSize('Hello')).toBe(5);
  });
});
