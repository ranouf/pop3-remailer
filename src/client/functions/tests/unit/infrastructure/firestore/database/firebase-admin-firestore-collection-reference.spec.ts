import { describe, expect, it, vi } from 'vitest';

import { FirebaseAdminFirestoreCollectionReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-collection-reference';
import { FirebaseAdminFirestoreDocumentReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-document-reference';

describe('infrastructure/firestore/database/firebase-admin-firestore-collection-reference', () => {
  it('creates wrapped document references and lists documents from a firebase collection', async () => {
    const firebaseDocumentReference = {};
    const doc = vi.fn(() => firebaseDocumentReference);
    const get = vi.fn(() =>
      Promise.resolve({
        docs: [
          {
            data: () => ({
              value: 'document-value',
            }),
            id: 'document-id',
          },
        ],
      }),
    );
    const collectionReference = new FirebaseAdminFirestoreCollectionReference<{
      readonly value: string;
    }>({
      doc,
      get,
    } as never);

    const documentReference = collectionReference.doc('document-id');
    const documents = await collectionReference.listDocuments();

    expect(doc).toHaveBeenCalledWith('document-id');
    expect(get).toHaveBeenCalledTimes(1);
    expect(documents).toEqual([
      {
        data: {
          value: 'document-value',
        },
        documentId: 'document-id',
      },
    ]);
    expect(documentReference).toBeInstanceOf(
      FirebaseAdminFirestoreDocumentReference,
    );
    expect(
      (
        documentReference as FirebaseAdminFirestoreDocumentReference<{
          readonly value: string;
        }>
      ).toFirebaseDocumentReference(),
    ).toBe(firebaseDocumentReference);
  });
});
