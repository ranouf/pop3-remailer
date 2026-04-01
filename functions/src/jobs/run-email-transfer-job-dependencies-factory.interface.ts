import type { EmailTransferJobDependencies } from '../application/email-transfer-job-dependencies.interface';
import type { AppConfig } from '../config/environment';

export interface RunEmailTransferJobDependenciesFactoryInterface {
  create(config: AppConfig): EmailTransferJobDependencies;
}
