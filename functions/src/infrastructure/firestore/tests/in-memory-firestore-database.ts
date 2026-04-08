import type {
  FirestoreCollectionDocument,
  FirestoreCollectionReference,
  FirestoreDatabase,
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
  FirestoreTransaction,
} from '../models';

type CollectionStore = Map<string, unknown>;

export class InMemoryFirestoreDatabase implements FirestoreDatabase {
  private readonly collections = new Map<string, CollectionStore>();

  public collection<T>(name: string): FirestoreCollectionReference<T> {
    return this.createCollectionReference<T>(
      this.getOrCreateCollectionStore(name),
    );
  }

  public async runTransaction<TResult>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const pendingWrites: Array<() => void> = [];
    const transaction = this.createTransaction(pendingWrites);
    const result = await updateFunction(transaction);

    for (const writeOperation of pendingWrites) {
      writeOperation();
    }

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
    const collectionStore = this.getOrCreateCollectionStore(collectionName);

    collectionStore.set(documentId, InMemoryFirestoreDatabase.deepClone(value));

    return Promise.resolve();
  }

  private getOrCreateCollectionStore(name: string): CollectionStore {
    const existingStore = this.collections.get(name);

    if (existingStore !== undefined) {
      return existingStore;
    }

    const collectionStore = new Map<string, unknown>();

    this.collections.set(name, collectionStore);

    return collectionStore;
  }

  private createCollectionReference<T>(
    collectionStore: CollectionStore,
  ): FirestoreCollectionReference<T> {
    return {
      doc: (documentId: string): FirestoreDocumentReference<T> =>
        this.createDocumentReference<T>(collectionStore, documentId),
      listDocuments: (): Promise<readonly FirestoreCollectionDocument<T>[]> =>
        Promise.resolve(
          [...collectionStore.entries()].map(([documentId, data]) => ({
            data: InMemoryFirestoreDatabase.deepClone(data as T),
            documentId,
          })),
        ),
    };
  }

  private createDocumentReference<T>(
    collectionStore: CollectionStore,
    documentId: string,
  ): FirestoreDocumentReference<T> {
    return {
      delete: (): Promise<void> => {
        collectionStore.delete(documentId);
        return Promise.resolve();
      },
      get: (): Promise<FirestoreDocumentSnapshot<T>> =>
        Promise.resolve(
          this.createDocumentSnapshot(
            collectionStore.get(documentId) as T | undefined,
          ),
        ),
      set: (
        data: Partial<T>,
        options?: { readonly merge?: boolean },
      ): Promise<void> => {
        if (options?.merge === true) {
          const currentValue = collectionStore.get(documentId) as
            | Record<string, unknown>
            | undefined;

          collectionStore.set(
            documentId,
            InMemoryFirestoreDatabase.mergeRecords(
              currentValue,
              data as Record<string, unknown>,
            ),
          );

          return Promise.resolve();
        }

        collectionStore.set(
          documentId,
          InMemoryFirestoreDatabase.deepClone(data),
        );

        return Promise.resolve();
      },
    };
  }

  private createDocumentSnapshot<T>(
    value: T | undefined,
  ): FirestoreDocumentSnapshot<T> {
    return {
      data: (): T | undefined =>
        value === undefined
          ? undefined
          : InMemoryFirestoreDatabase.deepClone(value),
      get exists(): boolean {
        return value !== undefined;
      },
    };
  }

  private createTransaction(
    pendingWrites: Array<() => void>,
  ): FirestoreTransaction {
    const transaction: FirestoreTransaction = {
      get: <T>(
        documentReference: FirestoreDocumentReference<T>,
      ): Promise<FirestoreDocumentSnapshot<T>> => documentReference.get(),
      set: <T>(
        documentReference: FirestoreDocumentReference<T>,
        data: Partial<T>,
        options?: { readonly merge?: boolean },
      ): FirestoreTransaction => {
        pendingWrites.push(() => {
          void documentReference.set(data, options);
        });

        return transaction;
      },
    };

    return transaction;
  }

  private static deepClone<T>(value: T): T {
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }

    if (Array.isArray(value)) {
      const arrayValue: unknown[] = value;

      return arrayValue.map((entry) => this.deepClone(entry)) as unknown as T;
    }

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(
          ([key, entryValue]) => [key, this.deepClone(entryValue)],
        ),
      ) as T;
    }

    return value;
  }

  private static mergeRecords<T extends Record<string, unknown>>(
    currentValue: T | undefined,
    nextValue: Partial<T>,
  ): T {
    const baseValue =
      currentValue === undefined ? {} : this.deepClone(currentValue);
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

        result[key] = this.mergeRecords(
          currentNestedValue,
          value as Record<string, unknown>,
        );
        continue;
      }

      result[key] = value;
    }

    return result as T;
  }
}
