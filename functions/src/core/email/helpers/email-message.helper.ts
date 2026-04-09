export class EmailMessageHelper {
  private static readonly messageIdPattern = /<([^>]+)>/u;

  public static extractRfc822MessageId(rawMessage: string): string | null {
    const headerValue = EmailMessageHelper.extractHeaderValue(
      rawMessage,
      'Message-ID',
    );

    if (headerValue === null) {
      return null;
    }

    const match = headerValue.match(EmailMessageHelper.messageIdPattern);

    return match?.[1] ?? headerValue;
  }

  public static getMessageSize(rawMessage: string): number {
    return Buffer.byteLength(rawMessage, 'utf8');
  }

  private static extractHeaderValue(
    rawMessage: string,
    headerName: string,
  ): string | null {
    const headerPattern = new RegExp(`^${headerName}:\\s*(.*)$`, 'imu');
    const match = rawMessage.match(headerPattern);

    if (match === null) {
      return null;
    }

    return match[1]?.trim() ?? null;
  }
}
