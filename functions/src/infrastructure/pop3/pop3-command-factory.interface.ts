import type { AppConfig } from '../../config/environment';
import type { Pop3CommandClientInterface } from './pop3-command-client.interface';

export interface Pop3CommandFactoryInterface {
  create(config: AppConfig['pop3']): Pop3CommandClientInterface;
}
