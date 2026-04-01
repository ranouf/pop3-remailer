import type { AppConfig } from '../../config/environment';
import type { OAuth2ClientLikeInterface } from './oauth2-client-like.interface';

export interface GmailOAuthProviderInterface {
  createClient(config: AppConfig['gmail']): OAuth2ClientLikeInterface;
}
