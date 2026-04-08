import type { CollectionReference } from 'firebase-admin/firestore';

import type {
  FirestoreCollectionDocument,
  FirestoreCollectionReference,
  FirestoreDocumentReference,
} from '../models';
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

  public async listDocuments(): Promise<
    readonly FirestoreCollectionDocument<T>[]
  > {
    const snapshot = await this.collectionReference.get();

    return snapshot.docs.map((documentSnapshot) => ({
      data: documentSnapshot.data(),
      documentId: documentSnapshot.id,
    }));
  }
}
