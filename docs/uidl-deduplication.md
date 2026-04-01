# UIDL Deduplication Strategy

## Primary key

The application uses the POP3 `UIDL` as the main deduplication key.

## Processing flow

1. List messages from POP3.
2. Claim each UIDL in Firestore before importing it.
3. Skip any UIDL already marked as `imported`.
4. Skip any UIDL already marked as `processing`.
5. Import the message into Gmail.
6. Mark the UIDL as `imported` with Gmail metadata.

## Concurrency behavior

The repository uses a Firestore transaction-based claim step. This prevents two
concurrent runs from importing the same UIDL at the same time.

## Partial failure behavior

If Gmail import succeeds but Firestore persistence fails:

1. the job tries to reconcile using the RFC822 `Message-ID`
2. if Gmail returns a message match, Firestore is updated with the recovered
   `gmailMessageId`
3. the next replay stays idempotent

If reconciliation is impossible, the failure is logged and tracked explicitly so
that the run can be investigated.

## Future extensibility

The stored record already keeps `sourceAccountId` and `sourceProvider`, so the
data model is ready for multiple source mailboxes later.
