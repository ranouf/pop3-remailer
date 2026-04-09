import type { ApplicationConfiguration } from '../../../../core/configuration/models/application-configuration';
import type { Pop3CommandClientInterface } from './pop3-command-client.interface';

export interface Pop3CommandFactoryInterface {
  create(config: ApplicationConfiguration['pop3']): Pop3CommandClientInterface;
}
