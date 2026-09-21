import type { FirestoreCollectionDocument } from './firestore-collection-document';
import type { FirestoreDocumentReference } from './firestore-document-reference';

export interface FirestoreCollectionReference<T> {
  doc(documentId: string): FirestoreDocumentReference<T>;
  listDocuments(): Promise<readonly FirestoreCollectionDocument<T>[]>;
}
