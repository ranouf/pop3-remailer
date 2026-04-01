import { describe, expect, it, vi } from 'vitest';

import type {
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
} from '../../../../../src/infrastructure/firestore/firestore-types';
import { FirebaseAdminFirestoreDocumentReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-document-reference';
import { FirebaseAdminFirestoreTransaction } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-transaction';

describe('infrastructure/firestore/database/firebase-admin-firestore-transaction', () => {
  it('uses the firebase transaction for wrapped document references', async () => {
    const firebaseSnapshot = {
      data: () => ({
        value: 'transaction-value',
      }),
      exists: true,
    };
    const firebaseTransactionGet = vi.fn(async () => firebaseSnapshot);
    const firebaseTransactionSet = vi.fn();
    const transaction = new FirebaseAdminFirestoreTransaction({
      get: firebaseTransactionGet,
      set: firebaseTransactionSet,
    } as never);
    const firebaseDocumentReference = {};
    const documentReference = new FirebaseAdminFirestoreDocumentReference<{
      readonly value: string;
    }>({
      get: vi.fn(async () => firebaseSnapshot),
      set: vi.fn(async () => undefined),
    } as never);
    Object.assign(documentReference, {
      toFirebaseDocumentReference: () => firebaseDocumentReference,
    });

    const snapshot = await transaction.get(documentReference);

    const returnedTransactionWithoutMerge = transaction.set(
      documentReference,
      {
        value: 'without-merge',
      },
    );
    const returnedTransactionWithMerge = transaction.set(
      documentReference,
      {
        value: 'with-merge',
      },
      {
        merge: true,
      },
    );

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toEqual({
      value: 'transaction-value',
    });
    expect(firebaseTransactionGet).toHaveBeenCalledWith(firebaseDocumentReference);
    expect(firebaseTransactionSet).toHaveBeenNthCalledWith(
      1,
      firebaseDocumentReference,
      {
        value: 'without-merge',
      },
    );
    expect(firebaseTransactionSet).toHaveBeenNthCalledWith(
      2,
      firebaseDocumentReference,
      {
        value: 'with-merge',
      },
      {
        merge: true,
      },
    );
    expect(returnedTransactionWithoutMerge).toBe(transaction);
    expect(returnedTransactionWithMerge).toBe(transaction);
  });

  it('falls back to the provided reference when it is not a firebase wrapper', async () => {
    const firebaseTransactionGet = vi.fn();
    const firebaseTransactionSet = vi.fn();
    const transaction = new FirebaseAdminFirestoreTransaction({
      get: firebaseTransactionGet,
      set: firebaseTransactionSet,
    } as never);
    const snapshot: FirestoreDocumentSnapshot<{ readonly value: string }> = {
      data: () => ({
        value: 'fallback-value',
      }),
      exists: true,
    };
    const documentReference: FirestoreDocumentReference<{
      readonly value: string;
    }> = {
      get: vi.fn(async () => snapshot),
      set: vi.fn(async () => undefined),
    };

    const returnedSnapshot = await transaction.get(documentReference);
    const returnedTransaction = transaction.set(
      documentReference,
      {
        value: 'ignored',
      },
      {
        merge: true,
      },
    );

    expect(returnedSnapshot).toBe(snapshot);
    expect(documentReference.get).toHaveBeenCalledTimes(1);
    expect(firebaseTransactionGet).not.toHaveBeenCalled();
    expect(firebaseTransactionSet).not.toHaveBeenCalled();
    expect(returnedTransaction).toBe(transaction);
  });
});
