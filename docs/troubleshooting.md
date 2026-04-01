# Troubleshooting

## Node.js 24 is active locally

Symptom:

- configuration loading fails with an unsupported runtime error

Fix:

```powershell
nvm use 20.19.1
node -v
```

## POP3 authentication fails

Checks:

- mailbox credentials are valid
- POP3 access is enabled on the Orange or Wanadoo mailbox
- `POP3_HOST` and `POP3_PORT` match the provider configuration
- TLS is enabled with `POP3_TLS=true`

## Gmail import fails

Checks:

- Gmail API is enabled
- refresh token is still valid
- `GMAIL_USER_EMAIL` matches the OAuth account
- scope `gmail.insert` has been granted

## Firestore writes fail in production

Checks:

- the Firebase project exists and is on the correct plan
- the deployment service account has deployment permissions
- Firestore is enabled in Native mode

## Scheduled function appears to run twice

This is possible with scheduled functions. The application is designed to be
idempotent through the Firestore UIDL claim step, so replay should not create
duplicate Gmail imports.

## Coverage falls below 90%

Run locally:

```powershell
npm run test --workspace functions
```

Then inspect:

- uncovered branches in new helpers
- new infrastructure adapters
- new orchestration branches
