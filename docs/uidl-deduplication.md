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
7. Run a best-effort cleanup of old imported UIDLs after the transfer loop.

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

## Retention cleanup

Imported UIDL records are not kept forever.

The cleanup policy deletes only records that match all of the following rules:

- status is `imported`
- `importedAt` is older than the configured retention window
- the record is not part of the latest retained floor for the same source
  account

The cleanup is controlled by these settings:

- `UIDL_RETENTION_DAYS`
- `UIDL_MINIMUM_RETAINED_COUNT`
- `UIDL_CLEANUP_BATCH_SIZE`

Default behavior:

- keep imported UIDLs for at least `30` days
- always keep at least the `100` most recent imported UIDLs per source account
- delete records in batches of up to `250`

This is a pragmatic storage strategy. It reduces Firestore growth while keeping
recent deduplication history available.

## Future extensibility

The stored record already keeps `sourceAccountId` and `sourceProvider`, so the
data model is ready for multiple source mailboxes later.
