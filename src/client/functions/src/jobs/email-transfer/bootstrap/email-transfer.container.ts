import { Container } from 'inversify';

import type { ApplicationConfiguration } from '../../../core/configuration/models/application-configuration';
import { CoreModule } from '../../../core/core.module';
import { InfrastructureModule } from '../../../infrastructure/infrastructure.module';
import { EmailTransferModule } from '../email-transfer.module';

export const createEmailTransferContainer = (
  options: {
    readonly config?: ApplicationConfiguration;
  } = {},
): Container => {
  const container = new Container();

  CoreModule.register(container, options);
  InfrastructureModule.register(container);
  EmailTransferModule.register(container);

  return container;
};
