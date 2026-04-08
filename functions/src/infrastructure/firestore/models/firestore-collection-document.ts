export interface FirestoreCollectionDocument<T> {
  readonly data: T;
  readonly documentId: string;
}
