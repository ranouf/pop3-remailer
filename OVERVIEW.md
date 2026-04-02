# Release Overview v1

## Summary

This release delivers the first maintainable version of the POP3S to Gmail
importer built on Firebase Functions v2.

## Highlights

- Firebase Functions v2 scheduled every 5 minutes
- Strict Node.js 22 alignment for local development, CI, and runtime
- POP3S ingestion with UIDL-based deduplication
- Gmail import through OAuth2 and the Gmail API
- Firestore-backed idempotency and job audit trail
- Amplitude tracking for operational visibility
- Pull request validation workflow
- Automated Firebase deployment workflow with GitHub release creation

## Operational notes

- The deployment workflow creates a temporary `functions/.env.<project-id>` file
  from GitHub Secrets before deploying.
- The deployed runtime relies on Google-provided project environment variables
  and does not inject `FIREBASE_PROJECT_ID` into Firebase dotenv files.
- Firestore rules remain backend-only and deny all client access.

## Follow-up checklist

- Confirm Firebase project APIs are enabled
- Confirm GitHub Workload Identity Federation is configured
- Confirm Gmail OAuth refresh token is valid
- Confirm POP3 access is enabled on the Orange or Wanadoo mailbox
