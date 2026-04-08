import type { FirestoreDocumentReference } from './firestore-document-reference';
import type { FirestoreDocumentSnapshot } from './firestore-document-snapshot';

export interface FirestoreTransaction {
  get<T>(
    documentReference: FirestoreDocumentReference<T>,
  ): Promise<FirestoreDocumentSnapshot<T>>;
  set<T>(
    documentReference: FirestoreDocumentReference<T>,
    data: Partial<T>,
    options?: { readonly merge?: boolean },
  ): FirestoreTransaction;
}
