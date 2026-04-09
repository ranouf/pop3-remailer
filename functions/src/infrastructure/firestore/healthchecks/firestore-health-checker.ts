import {
  JobErrorCategory,
  OperationErrorHelper,
  TransferJobError,
} from '../../../core/operation-error';
import {
  HealthCheckName,
  HealthCheckStatus,
  type HealthCheckResult,
} from '../../../core/health-check/models';
import type { FirestoreHealthChecker } from '../../../core/health-check/firestore-health-checker.interface';
import type { Clock } from '../../../core/time/clock.interface';
import { SystemClock } from '../../time/system-clock';
import { operationsHealthChecksCollectionName } from '../firestore-keys';
import type { FirestoreDatabase } from '../models';

export interface FirestoreConnectivityHealthCheckerDependencies {
  readonly clock?: Clock;
}

interface FirestoreHealthCheckRecord {
  readonly checkedAt: Date;
  readonly source: 'operations-api';
}

export class FirestoreConnectivityHealthChecker implements FirestoreHealthChecker {
  private readonly clock: Clock;
  private readonly database: FirestoreDatabase;

  public constructor(
    database: FirestoreDatabase,
    dependencies: FirestoreConnectivityHealthCheckerDependencies = {},
  ) {
    this.clock = dependencies.clock ?? new SystemClock();
    this.database = database;
  }

  public async check(): Promise<HealthCheckResult> {
    const checkedAt = this.clock.now();
    const documentReference = this.database
      .collection<FirestoreHealthCheckRecord>(
        operationsHealthChecksCollectionName,
      )
      .doc('firestore-healthcheck');

    try {
      await documentReference.set({
        checkedAt,
        source: 'operations-api',
      });

      const snapshot = await documentReference.get();

      if (!snapshot.exists || snapshot.data() === undefined) {
        throw new TransferJobError(
          'Firestore healthcheck document could not be read back after write.',
          {
            category: JobErrorCategory.Technical,
            code: 'FIRESTORE_HEALTHCHECK_FAILED',
            retriable: true,
          },
        );
      }

      await documentReference.delete();

      return {
        checkedAt,
        message: 'Firestore read/write connectivity succeeded.',
        name: HealthCheckName.Firestore,
        status: HealthCheckStatus.Healthy,
      };
    } catch (error) {
      throw OperationErrorHelper.create(error, {
        category: JobErrorCategory.Technical,
        code: 'FIRESTORE_HEALTHCHECK_FAILED',
        message: 'Failed to validate Firestore connectivity.',
        retriable: true,
      });
    }
  }
}
