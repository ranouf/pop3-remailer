import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type { FirestoreDocumentSnapshot } from '../types';

export class FirebaseAdminFirestoreDocumentSnapshot<
  T,
> implements FirestoreDocumentSnapshot<T> {
  private readonly snapshot: DocumentSnapshot<T>;

  public constructor(snapshot: DocumentSnapshot<T>) {
    this.snapshot = snapshot;
  }

  public get exists(): boolean {
    return this.snapshot.exists;
  }

  public data(): T | undefined {
    return this.snapshot.data();
  }
}
