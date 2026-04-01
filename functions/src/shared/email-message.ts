const messageIdPattern = /<([^>]+)>/u;

const extractHeaderValue = (
  rawMessage: string,
  headerName: string,
): string | null => {
  const headerPattern = new RegExp(`^${headerName}:\\s*(.*)$`, 'imu');
  const match = rawMessage.match(headerPattern);

  if (match === null) {
    return null;
  }

  return match[1]?.trim() ?? null;
};

export const extractRfc822MessageId = (rawMessage: string): string | null => {
  const headerValue = extractHeaderValue(rawMessage, 'Message-ID');

  if (headerValue === null) {
    return null;
  }

  const match = headerValue.match(messageIdPattern);

  return match?.[1] ?? headerValue;
};

export const encodeMessageForGmailImport = (rawMessage: string): string =>
  Buffer.from(rawMessage, 'utf8').toString('base64url');

export const getMessageSize = (rawMessage: string): number =>
  Buffer.byteLength(rawMessage, 'utf8');
