import type { HealthCheckReport } from './models';

export interface HealthCheckManagerInterface {
  execute(): Promise<HealthCheckReport>;
}
