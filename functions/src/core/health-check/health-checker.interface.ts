import type { HealthCheckResult } from './models';

export interface HealthChecker {
  check(): Promise<HealthCheckResult>;
}
