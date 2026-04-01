import { describe, expect, it, vi } from 'vitest';

import { FirebaseAdminFirestoreCollectionReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-collection-reference';
import { FirebaseAdminFirestoreDatabase } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-database';
import { FirebaseAdminFirestoreTransaction } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-transaction';

describe('infrastructure/firestore/database/firebase-admin-firestore-database', () => {
  it('wraps firebase collections and transactions', async () => {
    const firebaseCollectionReference = {
      doc: vi.fn(),
    };
    const firebaseRunTransaction = vi.fn(
      async (
        updateFunction: (transaction: { readonly name: string }) => Promise<string>,
      ) => updateFunction({
        name: 'firebase-transaction',
      }),
    );
    const database = new FirebaseAdminFirestoreDatabase({
      collection: vi.fn(() => firebaseCollectionReference),
      runTransaction: firebaseRunTransaction,
    } as never);

    const collection = database.collection<{
      readonly value: string;
    }>('processedEmails');
    const result = await database.runTransaction(async (transaction) => {
      expect(transaction).toBeInstanceOf(FirebaseAdminFirestoreTransaction);

      return 'transaction-result';
    });

    expect(collection).toBeInstanceOf(FirebaseAdminFirestoreCollectionReference);
    expect(result).toBe('transaction-result');
  });
});
