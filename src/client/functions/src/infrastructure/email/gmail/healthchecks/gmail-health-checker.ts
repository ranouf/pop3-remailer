import type { ApplicationConfiguration } from '../../../../core/configuration/models/application-configuration';
import {
  JobErrorCategory,
  OperationErrorHelper,
  TransferJobError,
} from '../../../../core/operation-error';
import {
  HealthCheckName,
  HealthCheckStatus,
  type HealthCheckResult,
} from '../../../../core/health-check/models';
import type { GmailHealthChecker } from '../../../../core/health-check/gmail-health-checker.interface';
import type { Clock } from '../../../../core/time/clock.interface';
import { SystemClock } from '../../../time/system-clock';
import type { GmailApiClientFactoryInterface } from '../client/gmail-api-client-factory.interface';
import { GmailApiClientFactory } from '../client/gmail-api-client-factory';
import type { GmailOAuthProviderInterface } from '../oauth/gmail-oauth-provider.interface';
import { GoogleGmailOAuthProvider } from '../oauth/gmail-oauth-provider';
import { GmailOAuthSettings } from '../settings/gmail-oauth.settings';

export interface GmailConnectivityHealthCheckerDependencies {
  readonly apiClientFactory?: GmailApiClientFactoryInterface;
  readonly clock?: Clock;
  readonly oauthProvider?: GmailOAuthProviderInterface;
}

export class GmailConnectivityHealthChecker implements GmailHealthChecker {
  private readonly apiClientFactory: GmailApiClientFactoryInterface;
  private readonly clock: Clock;
  private readonly gmailConfig: ApplicationConfiguration['gmail'];
  private readonly oauthProvider: GmailOAuthProviderInterface;

  public constructor(
    gmailConfig: ApplicationConfiguration['gmail'],
    dependencies: GmailConnectivityHealthCheckerDependencies = {},
  ) {
    this.apiClientFactory =
      dependencies.apiClientFactory ?? new GmailApiClientFactory();
    this.clock = dependencies.clock ?? new SystemClock();
    this.gmailConfig = gmailConfig;
    this.oauthProvider =
      dependencies.oauthProvider ?? new GoogleGmailOAuthProvider();
  }

  public async check(): Promise<HealthCheckResult> {
    const checkedAt = this.clock.now();

    try {
      const oauthClient = this.oauthProvider.createClient(this.gmailConfig);
      const gmailClient = this.apiClientFactory.create(oauthClient);
      const response = await gmailClient.users.getProfile({
        userId: this.gmailConfig.userEmail,
      });
      const emailAddress = response.data.emailAddress?.toLowerCase() ?? null;

      if (emailAddress === null) {
        throw new TransferJobError(
          'Gmail profile response did not include an email address.',
          {
            category: JobErrorCategory.Technical,
            code: 'GMAIL_HEALTHCHECK_FAILED',
            details: {
              gmailUserEmail: this.gmailConfig.userEmail,
              scope: GmailOAuthSettings.importScope,
            },
            retriable: true,
          },
        );
      }

      if (emailAddress !== this.gmailConfig.userEmail.toLowerCase()) {
        throw new TransferJobError(
          'Authenticated Gmail user does not match the configured mailbox.',
          {
            category: JobErrorCategory.Functional,
            code: 'GMAIL_HEALTHCHECK_FAILED',
            details: {
              authenticatedEmail: emailAddress,
              configuredEmail: this.gmailConfig.userEmail,
              scope: GmailOAuthSettings.importScope,
            },
            retriable: false,
          },
        );
      }

      return {
        checkedAt,
        message: `Gmail OAuth credentials are valid for ${emailAddress}.`,
        name: HealthCheckName.Gmail,
        status: HealthCheckStatus.Healthy,
      };
    } catch (error) {
      throw OperationErrorHelper.create(error, {
        category: JobErrorCategory.Technical,
        code: 'GMAIL_HEALTHCHECK_FAILED',
        details: {
          gmailUserEmail: this.gmailConfig.userEmail,
          scope: GmailOAuthSettings.importScope,
        },
        message: 'Failed to validate Gmail connectivity.',
        retriable: true,
      });
    }
  }
}
