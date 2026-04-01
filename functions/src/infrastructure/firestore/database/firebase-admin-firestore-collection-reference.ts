import type { CollectionReference } from 'firebase-admin/firestore';

import type {
  FirestoreCollectionReference,
  FirestoreDocumentReference,
} from '../firestore-types';
import { FirebaseAdminFirestoreDocumentReference } from './firebase-admin-firestore-document-reference';

export class FirebaseAdminFirestoreCollectionReference<
  T,
> implements FirestoreCollectionReference<T> {
  private readonly collectionReference: CollectionReference<T>;

  public constructor(collectionReference: CollectionReference<T>) {
    this.collectionReference = collectionReference;
  }

  public doc(documentId: string): FirestoreDocumentReference<T> {
    return new FirebaseAdminFirestoreDocumentReference(
      this.collectionReference.doc(documentId),
    );
  }
}
