import type { CollectionReference, Firestore } from 'firebase-admin/firestore';

import type {
  FirestoreCollectionReference,
  FirestoreDatabase,
  FirestoreTransaction,
} from '../firestore-types';
import { FirebaseAdminFirestoreCollectionReference } from './firebase-admin-firestore-collection-reference';
import { FirebaseAdminFirestoreTransaction } from './firebase-admin-firestore-transaction';

export class FirebaseAdminFirestoreDatabase implements FirestoreDatabase {
  private readonly firestore: Firestore;

  public constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  public collection<T>(name: string): FirestoreCollectionReference<T> {
    return new FirebaseAdminFirestoreCollectionReference(
      this.firestore.collection(name) as CollectionReference<T>,
    );
  }

  public runTransaction<TResult>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return this.firestore.runTransaction((transaction) =>
      updateFunction(new FirebaseAdminFirestoreTransaction(transaction)),
    );
  }
}
