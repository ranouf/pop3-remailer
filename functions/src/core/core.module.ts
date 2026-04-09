import type { Container } from 'inversify';

import type { ApplicationConfiguration } from './configuration/models/application-configuration';
import { ConfigurationManager } from './configuration/configuration-manager';
import type { ConfigurationManagerInterface } from './configuration/configuration-manager.interface';

export class CoreModule {
  public static readonly ApplicationConfiguration = Symbol.for(
    'Core.ApplicationConfiguration',
  );
  public static readonly ConfigurationManager = Symbol.for(
    'Core.ConfigurationManager',
  );

  public static register(
    container: Container,
    options: {
      readonly config?: ApplicationConfiguration;
    } = {},
  ): void {
    container
      .bind<ConfigurationManagerInterface>(CoreModule.ConfigurationManager)
      .toDynamicValue(() => new ConfigurationManager())
      .inTransientScope();

    if (options.config !== undefined) {
      container
        .bind<ApplicationConfiguration>(CoreModule.ApplicationConfiguration)
        .toConstantValue(options.config);
      return;
    }

    container
      .bind<ApplicationConfiguration>(CoreModule.ApplicationConfiguration)
      .toDynamicValue(() =>
        container
          .get<ConfigurationManagerInterface>(CoreModule.ConfigurationManager)
          .read(),
      )
      .inSingletonScope();
  }
}
