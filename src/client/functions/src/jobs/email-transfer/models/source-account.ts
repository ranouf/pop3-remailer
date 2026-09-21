export { SourceProvider } from '../../../core/email/processed-email';
import type { SourceProvider } from '../../../core/email/processed-email';

export class SourceAccount {
  public readonly address: string;
  public readonly id: string;
  public readonly provider: SourceProvider;
  public readonly username: string;

  public constructor(
    address: string,
    id: string,
    provider: SourceProvider,
    username: string,
  ) {
    this.address = address;
    this.id = id;
    this.provider = provider;
    this.username = username;
  }

  public static createId(provider: SourceProvider, address: string): string {
    return `${provider}:${address.trim().toLowerCase()}`;
  }
}
