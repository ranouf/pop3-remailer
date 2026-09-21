import type { ApplicationConfiguration } from './models/application-configuration';

export interface ConfigurationManagerInterface {
  read(): ApplicationConfiguration;
}
