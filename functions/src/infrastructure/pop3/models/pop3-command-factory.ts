import type { AppConfig } from '../../../config/environment';

import type { Pop3CommandClient } from './pop3-command-client';

export interface Pop3CommandFactory {
  create(config: AppConfig['pop3']): Pop3CommandClient;
}
