# pop3-remailer

[![Pull Request Validation](https://github.com/ranouf/pop3-remailer/actions/workflows/pull-request-validation.yml/badge.svg)](https://github.com/ranouf/pop3-remailer/actions/workflows/pull-request-validation.yml)
[![Firebase Deploy](https://github.com/ranouf/pop3-remailer/actions/workflows/firebase-deploy.yml/badge.svg)](https://github.com/ranouf/pop3-remailer/actions/workflows/firebase-deploy.yml)

This directory contains the Firebase API and Angular dashboard from the
original POP3 remailer. The active Orange-to-Gmail transfer runs locally in the
.NET application under [`../jobs`](../jobs). See the [root README](../../README.md)
for installation and transfer settings.

## What the solution includes

- A Firebase Functions v2 HTTP API for health checks and historical statistics
- Firestore-backed statistics from the earlier Firebase transfer job
- An Angular 21 + Tailwind CSS 4 dashboard deployed on Firebase Hosting
- Firebase Authentication with Google Sign-In for dashboard access
- Unified CI/CD for Hosting, Functions, Firestore rules, Firestore indexes,
  and GitHub release creation

## Key behaviors

- The Firebase scheduled POP3 transfer is no longer exported or deployed
- The dashboard's Firestore statistics do not include local .NET/SQLite runs;
  the Windows tray displays those runs
- The dashboard can only access the API when the Firebase-authenticated email
  matches the configured Gmail user email
- Firestore remains backend-only; the web app never reads Firestore directly

## Architecture

### Backend

- `functions/src/core`: configuration, job runs, statistics, and domain-level
  contracts
- `functions/src/infrastructure`: POP3, Gmail, Firestore, Firebase auth,
  logging, analytics, and configuration loaders
- `functions/src/api`: HTTP API, controllers, runtime wiring, and auth
- `functions/src/jobs`: retained legacy POP3 transfer code, not deployed as a
  scheduled function
- `functions/tests`: unit and integration coverage for the backend

### Frontend

- `web/src/app/core`: runtime config, auth, HTTP, and shared app services
- `web/src/app/features/login`: login screen with Firebase Google Sign-In
- `web/src/app/features/dashboard`: health checks, statistics, charts, and run
  summaries
- `web/src/app/app.routes.ts`: lazy-loaded routes for login and dashboard

## Tech stack

- Node.js 22
- Firebase Functions v2
- Firebase Hosting
- Firebase Authentication
- Firestore
- Angular 21
- Tailwind CSS 4
- Vitest
- TypeScript

## Prerequisites

- Node.js `22`
- npm `10.x`
- Firebase CLI
- A Firebase project on the Blaze plan
- Firebase Hosting enabled
- Firebase Authentication enabled with Google Sign-In
- A Firebase Web App configured for the project
- An Orange IMAP mailbox for the local .NET transfer job
- A Gmail API OAuth2 client with a refresh token
- An Amplitude project and API key

## Installation

```powershell
nvm use 22
npm ci
Copy-Item functions/.env.example functions/.env.local
```

Fill `functions/.env.local` with your local values.

## Environment variables

Local backend configuration is loaded from:

- `functions/.env.local`
- `functions/.env.test.local`

Required keys are documented in:

- [functions/.env.example](functions/.env.example)
- [docs/github-secrets.md](docs/github-secrets.md)

Important examples:

- `ENVIRONMENT_NAME`
- `SOURCE_PROVIDER`
- `SOURCE_EMAIL_ADDRESS`
- `POP3_*`
- `GMAIL_*`
- `AMPLITUDE_API_KEY`
- `UIDL_RETENTION_DAYS`
- `UIDL_MINIMUM_RETAINED_COUNT`
- `UIDL_CLEANUP_BATCH_SIZE`

## Local development

### Backend-only emulators

```powershell
npm run emulators
```

### Full local stack that mirrors production more closely

```powershell
npm run start:local
```

This command builds the backend and frontend, then starts:

- Firebase Hosting emulator
- Firebase Auth emulator
- Firebase Functions emulator
- Firestore emulator
- Pub/Sub emulator

Open:

- [http://127.0.0.1:5000](http://127.0.0.1:5000)

### Angular dev server

```powershell
npm run start --workspace web
```

Open:

- [http://localhost:4200](http://localhost:4200)

### Run the local transfer job

```powershell
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet run --project src/jobs/IMAPRemailer.Jobs -- --once
```

Run this from the repository root.
The .NET job reads its own `appsettings.json` and ignored
`appsettings.Development.json`; the Firebase dotenv file does not configure it.

## Quality gates

The repository uses the same quality bar across both workspaces.

- Lint: ESLint
- Formatting: Prettier
- Type checks: TypeScript
- Tests: Vitest
- Minimum coverage threshold: `90%`

Useful commands:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test
npm run coverage
npm run verify
```

## Deployment

Pushes to `main` that change `src/client/**` trigger the Firebase deployment
workflow; it can also be started manually:

- [firebase-deploy.yml](../../.github/workflows/firebase-deploy.yml)

That workflow:

- installs dependencies
- builds `functions` and `web`
- deploys Firebase Hosting
- deploys Firebase Functions
- deploys Firestore rules and indexes
- creates a GitHub release from [OVERVIEW.md](OVERVIEW.md)

## Project structure

```text
functions/
  src/
    api/
    core/
    infrastructure/
    jobs/
    index.ts
  tests/
web/
  src/
    app/
docs/
firebase.json
firestore.rules
README.md
OVERVIEW.md
```

The repository also contains `src/jobs/` and `.github/workflows/` at its root.

## Documentation

- [Local development](docs/local-development.md)
- [Firebase setup](docs/firebase-setup.md)
- [Firestore configuration](docs/firestore-configuration.md)
- [Gmail API configuration](docs/gmail-api-configuration.md)
- [GitHub secrets](docs/github-secrets.md)
- [UIDL deduplication strategy](docs/uidl-deduplication.md)
- [Amplitude tracking](docs/amplitude-tracking.md)
- [CI/CD workflows](docs/ci-cd.md)
- [Troubleshooting](docs/troubleshooting.md)
