export interface FirestoreTimestamp {
  toDate(): Date;
}

export interface FirestoreDocumentSnapshot<T> {
  readonly exists: boolean;
  data(): T | undefined;
}

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

export interface FirestoreDocumentReference<T> {
  get(): Promise<FirestoreDocumentSnapshot<T>>;
  set(data: Partial<T>, options?: { readonly merge?: boolean }): Promise<void>;
}

export interface FirestoreCollectionReference<T> {
  doc(documentId: string): FirestoreDocumentReference<T>;
}

export interface FirestoreDatabase {
  collection<T>(name: string): FirestoreCollectionReference<T>;
  runTransaction<TResult>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}
