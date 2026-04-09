import {
  HealthCheckName,
  HealthCheckStatus,
} from '../../../../src/core/health-check/models';
import { TransferJobError } from '../../../../src/core/operation-error';
import { FirestoreConnectivityHealthChecker } from '../../../../src/infrastructure/firestore/healthchecks/firestore-health-checker';
import { operationsHealthChecksCollectionName } from '../../../../src/infrastructure/firestore/firestore-keys';
import type {
  FirestoreCollectionDocument,
  FirestoreCollectionReference,
  FirestoreDatabase,
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
  FirestoreTransaction,
} from '../../../../src/infrastructure/firestore/models';
import { InMemoryFirestoreDatabase } from '../../../../src/infrastructure/firestore/tests/in-memory-firestore-database';

class FakeDocumentSnapshot<T> implements FirestoreDocumentSnapshot<T> {
  public constructor(
    public readonly exists: boolean,
    private readonly value: T | undefined,
  ) {}

  public data(): T | undefined {
    return this.value;
  }
}

class FakeDocumentReference<T> implements FirestoreDocumentReference<T> {
  public delete(): Promise<void> {
    return Promise.resolve();
  }

  public get(): Promise<FirestoreDocumentSnapshot<T>> {
    return Promise.resolve(new FakeDocumentSnapshot(false, undefined));
  }

  public set(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeCollectionReference<T> implements FirestoreCollectionReference<T> {
  public doc(): FirestoreDocumentReference<T> {
    return new FakeDocumentReference<T>();
  }

  public listDocuments(): Promise<readonly FirestoreCollectionDocument<T>[]> {
    return Promise.resolve([]);
  }
}

class FakeFirestoreDatabase implements FirestoreDatabase {
  public collection<T>(): FirestoreCollectionReference<T> {
    return new FakeCollectionReference<T>();
  }

  public runTransaction<TResult>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return updateFunction({} as FirestoreTransaction);
  }
}

describe('infrastructure/firestore/firestore-health-checker', () => {
  it('performs a lightweight read/write roundtrip', async () => {
    const database = new InMemoryFirestoreDatabase();
    const checker = new FirestoreConnectivityHealthChecker(database, {
      clock: {
        now: () => new Date('2026-04-02T10:00:00.000Z'),
      },
    });

    await expect(checker.check()).resolves.toEqual({
      checkedAt: new Date('2026-04-02T10:00:00.000Z'),
      message: 'Firestore read/write connectivity succeeded.',
      name: HealthCheckName.Firestore,
      status: HealthCheckStatus.Healthy,
    });

    await expect(
      database.readDocument(
        operationsHealthChecksCollectionName,
        'firestore-healthcheck',
      ),
    ).resolves.toBeUndefined();
  });

  it('fails when the healthcheck document cannot be read back after the write', async () => {
    const checker = new FirestoreConnectivityHealthChecker(
      new FakeFirestoreDatabase(),
      {
        clock: {
          now: () => new Date('2026-04-02T10:00:00.000Z'),
        },
      },
    );

    const error = await checker
      .check()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.code).toBe('FIRESTORE_HEALTHCHECK_FAILED');
    expect(error.message).toBe(
      'Firestore healthcheck document could not be read back after write.',
    );
  });
});
