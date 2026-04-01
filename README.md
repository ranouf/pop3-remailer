# pop3-remailer

[![Pull Request Validation](https://github.com/ranouf/pop3-remailer/actions/workflows/pull-request-validation.yml/badge.svg)](https://github.com/ranouf/pop3-remailer/actions/workflows/pull-request-validation.yml)
[![Firebase Deploy](https://github.com/ranouf/pop3-remailer/actions/workflows/firebase-deploy.yml/badge.svg)](https://github.com/ranouf/pop3-remailer/actions/workflows/firebase-deploy.yml)

`pop3-remailer` is a Firebase Functions v2 project that reads a POP3S mailbox
every 5 minutes, imports new messages into Gmail, deduplicates them through
Firestore UIDL records, and tracks the job in Amplitude.

## Objective

- Keep Orange or Wanadoo emails synchronized into Gmail without sending them.
- Prevent duplicates with a UIDL-first idempotency strategy.
- Run the same Node.js 20 runtime locally, in CI, and on Firebase.
- Keep the codebase layered, typed, documented, and ready for maintenance.

## Architecture

- `functions/src/domain`: business types, invariants, repository contracts
- `functions/src/application`: orchestration use case
- `functions/src/infrastructure`: POP3, Gmail, Firestore, analytics, logging
- `functions/src/config`: runtime and environment validation
- `functions/src/jobs`: Firebase and local entry points
- `functions/src/shared`: focused reusable helpers

## Prerequisites

- Node.js `20.19.1`
- npm `10.x`
- Firebase CLI
- A Firebase project on the Blaze plan
- A POP3-enabled Orange or Wanadoo mailbox
- A Gmail API OAuth2 client with a refresh token
- An Amplitude project and API key

## Installation

```powershell
nvm use 20.19.1
npm install
Copy-Item functions/.env.example functions/.env.local
```

Fill `functions/.env.local` with your local values, then run:

```powershell
npm run build --workspace functions
npm run test --workspace functions
```

## Environment variables

Local configuration is loaded from:

- `functions/.env.local`
- `functions/.env.test.local`

Required keys are documented in:

- [functions/.env.example](C:\Users\CedricArnould\source\repos\pop3-remailer\functions\.env.example)
- [docs/github-secrets.md](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\github-secrets.md)

## Local execution

- Run the build: `npm run build --workspace functions`
- Run tests with coverage: `npm run test --workspace functions`
- Start Firebase emulators: `npm run emulators`
- Simulate the scheduled job locally:

```powershell
npm run build --workspace functions
node functions/lib/jobs/run-email-transfer-job-local.js
```

## Tests and coverage

- Test runner: Vitest
- Global thresholds: `90%` on lines, branches, functions, and statements
- Current validation command:

```powershell
npm run test --workspace functions
```

## Deployment

- Pull requests are validated by [pull-request-validation.yml](C:\Users\CedricArnould\source\repos\pop3-remailer\.github\workflows\pull-request-validation.yml)
- Pushes to `main` deploy through [firebase-deploy.yml](C:\Users\CedricArnould\source\repos\pop3-remailer\.github\workflows\firebase-deploy.yml)
- The deployment workflow creates a GitHub release using [OVERVIEW.md](C:\Users\CedricArnould\source\repos\pop3-remailer\OVERVIEW.md)

## Project structure

```text
functions/
  src/
    application/
    config/
    domain/
    infrastructure/
    jobs/
    shared/
    index.ts
  tests/
.github/
  workflows/
docs/
firebase.json
firestore.rules
README.md
OVERVIEW.md
```

## Documentation

- [Local development](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\local-development.md)
- [Firebase setup](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\firebase-setup.md)
- [Firestore configuration](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\firestore-configuration.md)
- [Gmail API configuration](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\gmail-api-configuration.md)
- [GitHub secrets](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\github-secrets.md)
- [UIDL deduplication strategy](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\uidl-deduplication.md)
- [Amplitude tracking](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\amplitude-tracking.md)
- [CI/CD workflows](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\ci-cd.md)
- [Troubleshooting](C:\Users\CedricArnould\source\repos\pop3-remailer\docs\troubleshooting.md)

## Assumptions

- The project currently uses environment variables read from `process.env`.
- For production deployment, the workflow writes a temporary
  `functions/.env.<project-id>` file from GitHub Secrets just before
  `firebase deploy`.
- `FIREBASE_PROJECT_ID` is used by the workflow itself, but it is intentionally
  not written into the deployed dotenv file because Firebase reserves
  `FIREBASE_*` keys in function environment configuration.
