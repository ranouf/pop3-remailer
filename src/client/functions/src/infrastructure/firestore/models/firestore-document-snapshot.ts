export interface FirestoreDocumentSnapshot<T> {
  readonly exists: boolean;
  data(): T | undefined;
}
