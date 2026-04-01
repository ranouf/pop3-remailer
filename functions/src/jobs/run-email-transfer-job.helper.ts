import { EmailTransferJob } from '../application/email-transfer-job';
import { readAppConfig } from '../config/environment';
import { DefaultRunEmailTransferJobDependenciesFactory } from './default-run-email-transfer-job-dependencies.factory';
import type { RunEmailTransferJobOptionsInterface } from './run-email-transfer-job-options.interface';

export class RunEmailTransferJobHelper {
  public static async run(
    this: void,
    options: RunEmailTransferJobOptionsInterface = {},
  ) {
    const config = options.config ?? readAppConfig();
    const dependencies =
      options.dependenciesFactory?.create(config) ??
      new DefaultRunEmailTransferJobDependenciesFactory().create(config);

    return new EmailTransferJob(config, dependencies).run();
  }
}
