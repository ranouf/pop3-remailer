import type { SourceProvider } from '../../../jobs/email-transfer/models/source-account';

export class ApplicationConfiguration {
  public constructor(
    public readonly analytics: {
      readonly amplitudeApiKey: string;
      readonly environmentName: string;
    },
    public readonly firebase: {
      readonly projectId: string;
    },
    public readonly gmail: {
      readonly clientId: string;
      readonly clientSecret: string;
      readonly maxImportRetries: number;
      readonly refreshToken: string;
      readonly timeoutMs: number;
      readonly userEmail: string;
    },
    public readonly job: {
      readonly maxMessagesPerRun: number;
      readonly schedule: string;
      readonly uidlCleanup: {
        readonly cleanupBatchSize: number;
        readonly minimumRetainedCount: number;
        readonly retentionDays: number;
      };
    },
    public readonly pop3: {
      readonly host: string;
      readonly password: string;
      readonly port: number;
      readonly timeoutMs: number;
      readonly tls: boolean;
      readonly username: string;
    },
    public readonly runtime: {
      readonly environmentName: string;
      readonly loadedEnvironmentFilePath?: string;
    },
    public readonly sourceAccount: {
      readonly address: string;
      readonly id: string;
      readonly provider: SourceProvider;
      readonly username: string;
    },
  ) {}
}
