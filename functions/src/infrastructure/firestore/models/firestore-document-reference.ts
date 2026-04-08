import type { FirestoreDocumentSnapshot } from './firestore-document-snapshot';

export interface FirestoreDocumentReference<T> {
  delete(): Promise<void>;
  get(): Promise<FirestoreDocumentSnapshot<T>>;
  set(data: Partial<T>, options?: { readonly merge?: boolean }): Promise<void>;
}
