import type { AppConfig } from '../config/environment';
import type { RunEmailTransferJobDependenciesFactoryInterface } from './run-email-transfer-job-dependencies-factory.interface';

export interface RunEmailTransferJobOptionsInterface {
  readonly config?: AppConfig;
  readonly dependenciesFactory?: RunEmailTransferJobDependenciesFactoryInterface;
}
