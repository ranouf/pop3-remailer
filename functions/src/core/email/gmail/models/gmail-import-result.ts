export class GmailImportResult {
  public readonly gmailMessageId?: string;
  public readonly gmailThreadId?: string;

  public constructor(params: {
    readonly gmailMessageId?: string;
    readonly gmailThreadId?: string;
  }) {
    if (params.gmailMessageId !== undefined) {
      this.gmailMessageId = params.gmailMessageId;
    }

    if (params.gmailThreadId !== undefined) {
      this.gmailThreadId = params.gmailThreadId;
    }
  }
}
