import type {
  DocumentReference,
  Transaction,
  WithFieldValue,
} from 'firebase-admin/firestore';

import type {
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
  FirestoreTransaction,
} from '../types';
import { FirebaseAdminFirestoreDocumentReference } from './firebase-admin-firestore-document-reference';
import { FirebaseAdminFirestoreDocumentSnapshot } from './firebase-admin-firestore-document-snapshot';

export class FirebaseAdminFirestoreTransaction implements FirestoreTransaction {
  private readonly transaction: Transaction;

  public constructor(transaction: Transaction) {
    this.transaction = transaction;
  }

  public async get<T>(
    documentReference: FirestoreDocumentReference<T>,
  ): Promise<FirestoreDocumentSnapshot<T>> {
    if (
      !(documentReference instanceof FirebaseAdminFirestoreDocumentReference)
    ) {
      return documentReference.get();
    }

    return new FirebaseAdminFirestoreDocumentSnapshot(
      await this.transaction.get(
        documentReference.toFirebaseDocumentReference(),
      ),
    );
  }

  public set<T>(
    documentReference: FirestoreDocumentReference<T>,
    data: Partial<T>,
    options?: { readonly merge?: boolean },
  ): FirestoreTransaction {
    if (
      !(documentReference instanceof FirebaseAdminFirestoreDocumentReference)
    ) {
      return this;
    }

    const firebaseDocumentReference =
      documentReference.toFirebaseDocumentReference() as DocumentReference<T>;

    if (options?.merge === undefined) {
      this.transaction.set(
        firebaseDocumentReference,
        data as WithFieldValue<T>,
      );
      return this;
    }

    this.transaction.set(firebaseDocumentReference, data as WithFieldValue<T>, {
      merge: options.merge,
    });

    return this;
  }
}
