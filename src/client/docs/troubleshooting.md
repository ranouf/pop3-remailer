# Troubleshooting

## Node.js 24 is active locally

Symptom:

- configuration loading fails with an unsupported runtime error

Fix:

```powershell
nvm use 22
node -v
```

## POP3 authentication fails

This applies to the Firebase API's POP3 health check and retained legacy code.
For the active local IMAP job, check `OrangeSettings` in the ignored
`src/jobs/IMAPRemailer.Jobs/appsettings.Development.json` instead.

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

## Local IMAP job appears to run twice

Check that only one `IMAP Remailer` scheduled task or background process is
running. The local job records confirmed imports in SQLite and checks Gmail
before importing, so a retried run can resume archiving without duplicating
confirmed messages.

## Coverage falls below 90%

Run locally:

```powershell
npm run test --workspace functions
```

Then inspect:

- uncovered branches in new helpers
- new infrastructure adapters
- new orchestration branches
