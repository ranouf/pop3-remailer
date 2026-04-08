export const encodeMessageForGmailImport = (rawMessage: string): string =>
  Buffer.from(rawMessage, 'utf8').toString('base64url');
