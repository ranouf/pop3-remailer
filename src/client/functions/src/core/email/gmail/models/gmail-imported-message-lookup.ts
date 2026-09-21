export class GmailImportedMessageLookup {
  public readonly gmailMessageId: string;

  public constructor(params: { readonly gmailMessageId: string }) {
    this.gmailMessageId = params.gmailMessageId;
  }
}
