import type { ApplicationConfiguration } from '../../../../core/configuration/models/application-configuration';
import type { OAuth2ClientLikeInterface } from './oauth2-client-like.interface';

export interface GmailOAuthProviderInterface {
  createClient(
    config: ApplicationConfiguration['gmail'],
  ): OAuth2ClientLikeInterface;
}
