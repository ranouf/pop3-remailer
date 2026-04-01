import { describe, expect, it, vi } from 'vitest';

import { FirebaseAdminFirestoreDocumentReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-document-reference';

describe('infrastructure/firestore/database/firebase-admin-firestore-document-reference', () => {
  it('wraps get and set operations for a firebase document reference', async () => {
    const firebaseGet = vi.fn(() =>
      Promise.resolve({
        data: () => ({
          value: 'document-value',
        }),
        exists: true,
      }),
    );
    const firebaseSet = vi.fn(() => Promise.resolve());
    const firebaseDelete = vi.fn(() => Promise.resolve());
    const firebaseDocumentReference = {
      delete: firebaseDelete,
      get: firebaseGet,
      set: firebaseSet,
    };
    const documentReference = new FirebaseAdminFirestoreDocumentReference<{
      readonly value: string;
    }>(firebaseDocumentReference as never);

    const snapshot = await documentReference.get();

    await documentReference.set({
      value: 'without-merge',
    });
    await documentReference.set(
      {
        value: 'with-merge',
      },
      {
        merge: true,
      },
    );
    await documentReference.delete();

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toEqual({
      value: 'document-value',
    });
    expect(firebaseSet).toHaveBeenNthCalledWith(1, {
      value: 'without-merge',
    });
    expect(firebaseSet).toHaveBeenNthCalledWith(
      2,
      {
        value: 'with-merge',
      },
      {
        merge: true,
      },
    );
    expect(firebaseDelete).toHaveBeenCalledTimes(1);
    expect(documentReference.toFirebaseDocumentReference()).toBe(
      firebaseDocumentReference,
    );
  });
});
