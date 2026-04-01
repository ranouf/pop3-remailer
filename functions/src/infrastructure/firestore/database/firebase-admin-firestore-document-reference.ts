import type {
  DocumentReference,
  WithFieldValue,
} from 'firebase-admin/firestore';

import type {
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
} from '../firestore-types';
import { FirebaseAdminFirestoreDocumentSnapshot } from './firebase-admin-firestore-document-snapshot';

export class FirebaseAdminFirestoreDocumentReference<T>
  implements FirestoreDocumentReference<T>
{
  private readonly documentReference: DocumentReference<T>;

  public constructor(documentReference: DocumentReference<T>) {
    this.documentReference = documentReference;
  }

  public async get(): Promise<FirestoreDocumentSnapshot<T>> {
    return new FirebaseAdminFirestoreDocumentSnapshot(
      await this.documentReference.get(),
    );
  }

  public async set(
    data: Partial<T>,
    options?: { readonly merge?: boolean },
  ): Promise<void> {
    if (options?.merge === undefined) {
      await this.documentReference.set(data as WithFieldValue<T>);
      return;
    }

    await this.documentReference.set(data as WithFieldValue<T>, {
      merge: options.merge,
    });
  }

  public toFirebaseDocumentReference(): DocumentReference<T> {
    return this.documentReference;
  }
}
