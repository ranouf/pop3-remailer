# Firestore Configuration

## Collections

### `processedEmails`

Stores UIDL-based deduplication records.

Fields:

- `uidl`
- `createdAt`
- `updatedAt`
- `importedAt`
- `gmailMessageId`
- `sourceAccountId`
- `sourceProvider`
- `status`
- `lastError`
- `metadata`

Statuses:

- `processing`
- `imported`
- `failed`

Retention behavior:

- imported UIDLs can be cleaned up after the configured retention window
- cleanup always preserves a minimum number of recent imported UIDLs per source
  account
- cleanup is executed by the backend job, not by client code

### `jobRuns`

Stores lightweight audit information for each transfer run.

Fields:

- `jobId`
- `provider`
- `sourceAccountId`
- `startedAt`
- `finishedAt`
- `status`
- `detectedCount`
- `processedCount`
- `transferredCount`
- `skippedCount`
- `failedCount`
- `durationMs`
- `lastError`

## Rules

The project uses backend-only access.

Current rules in [firestore.rules](C:\Users\CedricArnould\source\repos\pop3-remailer\firestore.rules):

- deny all client reads
- deny all client writes

This is coherent because the backend uses the Firebase Admin SDK, which bypasses
Firestore Security Rules.

## Deployment

Firestore rules and indexes are deployed with:

```powershell
firebase deploy --only firestore
```
