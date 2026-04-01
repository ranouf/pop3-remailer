import type {
  FirestoreCollectionDocument,
  FirestoreCollectionReference,
  FirestoreDatabase,
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
  FirestoreTransaction,
} from '../../../src/infrastructure/firestore/types';

type CollectionStore = Map<string, unknown>;

const deepClone = <T>(value: T): T =>
  value instanceof Date
    ? (new Date(value.getTime()) as T)
    : Array.isArray(value)
      ? ((value as readonly unknown[]).map((entry) => deepClone(entry)) as T)
      : value !== null && typeof value === 'object'
        ? (Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(
              ([key, entryValue]) => [key, deepClone(entryValue)],
            ),
          ) as T)
        : value;

const mergeRecords = <T extends Record<string, unknown>>(
  currentValue: T | undefined,
  nextValue: Partial<T>,
): T => {
  const baseValue = currentValue === undefined ? {} : deepClone(currentValue);
  const result: Record<string, unknown> = {
    ...baseValue,
  };

  for (const [key, value] of Object.entries(nextValue)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const currentNestedValue =
        result[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key]) &&
        !(result[key] instanceof Date)
          ? (result[key] as Record<string, unknown>)
          : undefined;

      result[key] = mergeRecords(
        currentNestedValue,
        value as Record<string, unknown>,
      );
      continue;
    }

    result[key] = value;
  }

  return result as T;
};

class InMemoryDocumentSnapshot<T> implements FirestoreDocumentSnapshot<T> {
  private readonly value: T | undefined;

  public constructor(value: T | undefined) {
    this.value = value;
  }

  public get exists(): boolean {
    return this.value !== undefined;
  }

  public data(): T | undefined {
    return this.value === undefined ? undefined : deepClone(this.value);
  }
}

class InMemoryDocumentReference<T> implements FirestoreDocumentReference<T> {
  private readonly collectionStore: CollectionStore;
  private readonly documentId: string;

  public constructor(collectionStore: CollectionStore, documentId: string) {
    this.collectionStore = collectionStore;
    this.documentId = documentId;
  }

  public get(): Promise<FirestoreDocumentSnapshot<T>> {
    return Promise.resolve(
      new InMemoryDocumentSnapshot(
        this.collectionStore.get(this.documentId) as T | undefined,
      ),
    );
  }

  public delete(): Promise<void> {
    this.collectionStore.delete(this.documentId);
    return Promise.resolve();
  }

  public set(
    data: Partial<T>,
    options?: { readonly merge?: boolean },
  ): Promise<void> {
    if (options?.merge === true) {
      const currentValue = this.collectionStore.get(this.documentId) as
        | Record<string, unknown>
        | undefined;

      this.collectionStore.set(
        this.documentId,
        mergeRecords(currentValue, data as Record<string, unknown>),
      );
      return Promise.resolve();
    }

    this.collectionStore.set(this.documentId, deepClone(data));

    return Promise.resolve();
  }
}

class InMemoryCollectionReference<
  T,
> implements FirestoreCollectionReference<T> {
  private readonly collectionStore: CollectionStore;

  public constructor(collectionStore: CollectionStore) {
    this.collectionStore = collectionStore;
  }

  public doc(documentId: string): FirestoreDocumentReference<T> {
    return new InMemoryDocumentReference<T>(this.collectionStore, documentId);
  }

  public listDocuments(): Promise<readonly FirestoreCollectionDocument<T>[]> {
    return Promise.resolve(
      [...this.collectionStore.entries()].map(([documentId, data]) => ({
        data: deepClone(data as T),
        documentId,
      })),
    );
  }
}

class InMemoryTransaction implements FirestoreTransaction {
  private readonly pendingWrites: Array<() => void> = [];

  public constructor() {}

  public get<T>(
    documentReference: FirestoreDocumentReference<T>,
  ): Promise<FirestoreDocumentSnapshot<T>> {
    return documentReference.get();
  }

  public set<T>(
    documentReference: FirestoreDocumentReference<T>,
    data: Partial<T>,
    options?: { readonly merge?: boolean },
  ): FirestoreTransaction {
    this.pendingWrites.push(() => {
      void documentReference.set(data, options);
    });

    return this;
  }

  public commit(): void {
    for (const writeOperation of this.pendingWrites) {
      writeOperation();
    }
  }
}

export class InMemoryFirestoreDatabase implements FirestoreDatabase {
  private readonly collections = new Map<string, CollectionStore>();

  public collection<T>(name: string): FirestoreCollectionReference<T> {
    const collectionStore =
      this.collections.get(name) ?? new Map<string, unknown>();

    this.collections.set(name, collectionStore);

    return new InMemoryCollectionReference<T>(collectionStore);
  }

  public async runTransaction<TResult>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const transaction = new InMemoryTransaction();
    const result = await updateFunction(transaction);

    transaction.commit();

    return result;
  }

  public readDocument<T>(
    collectionName: string,
    documentId: string,
  ): Promise<T | undefined> {
    const collectionStore = this.collections.get(collectionName);

    return Promise.resolve(collectionStore?.get(documentId) as T | undefined);
  }

  public writeDocument<T>(
    collectionName: string,
    documentId: string,
    value: T,
  ): Promise<void> {
    const collectionStore =
      this.collections.get(collectionName) ?? new Map<string, unknown>();

    collectionStore.set(documentId, deepClone(value));
    this.collections.set(collectionName, collectionStore);

    return Promise.resolve();
  }
}
