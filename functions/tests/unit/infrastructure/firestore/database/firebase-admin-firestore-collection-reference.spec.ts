import { describe, expect, it, vi } from 'vitest';

import { FirebaseAdminFirestoreCollectionReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-collection-reference';
import { FirebaseAdminFirestoreDocumentReference } from '../../../../../src/infrastructure/firestore/database/firebase-admin-firestore-document-reference';

describe('infrastructure/firestore/database/firebase-admin-firestore-collection-reference', () => {
  it('creates wrapped document references from a firebase collection', () => {
    const firebaseDocumentReference = {};
    const doc = vi.fn(() => firebaseDocumentReference);
    const collectionReference = new FirebaseAdminFirestoreCollectionReference<{
      readonly value: string;
    }>({
      doc,
    } as never);

    const documentReference = collectionReference.doc('document-id');

    expect(doc).toHaveBeenCalledWith('document-id');
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
