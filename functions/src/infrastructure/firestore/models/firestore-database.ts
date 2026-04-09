import type { FirestoreCollectionReference } from './firestore-collection-reference';
import type { FirestoreTransaction } from './firestore-transaction';

export interface FirestoreDatabase {
  collection<T>(name: string): FirestoreCollectionReference<T>;
  runTransaction<TResult>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}
