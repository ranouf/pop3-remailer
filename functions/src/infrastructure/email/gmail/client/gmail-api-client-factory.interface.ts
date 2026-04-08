import type { GmailApiClientInterface } from './gmail-api-client.interface';
import type { OAuth2ClientLikeInterface } from '../oauth/oauth2-client-like.interface';

export interface GmailApiClientFactoryInterface {
  create(auth: OAuth2ClientLikeInterface): GmailApiClientInterface;
}
