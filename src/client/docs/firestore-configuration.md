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

### `jobRunStatistics`

Stores the persisted statistics projection used by the operations API and
dashboard.

The current design stores one projection document per source account so the API
can serve a ready-to-read view instead of recalculating everything on every
request.

Typical contents:

- generated timestamps
- KPI values
- daily points
- recent runs
- recent errors
- source account identifier

## Rules

The project uses backend-only access.

Current rules in [firestore.rules](../firestore.rules):

- deny all client reads
- deny all client writes

This is intentional because:

- the backend uses the Firebase Admin SDK
- the Angular dashboard reads the API, not Firestore directly

## Deployment

Firestore rules and indexes are deployed together with:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```
