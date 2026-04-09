import { describe, expect, it } from 'vitest';

import { FirebaseAdminFirestoreDocumentSnapshot } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-document-snapshot';

describe('infrastructure/firestore/database/firebase-admin-firestore-document-snapshot', () => {
  it('exposes the exists flag and data from the firebase snapshot', () => {
    const snapshot = new FirebaseAdminFirestoreDocumentSnapshot<{
      readonly value: string;
    }>({
      data: () => ({
        value: 'snapshot-value',
      }),
      exists: true,
    } as never);

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toEqual({
      value: 'snapshot-value',
    });
  });
});
