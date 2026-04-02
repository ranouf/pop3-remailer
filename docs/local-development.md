# Local Development

## Runtime

Use Node.js `22` everywhere locally.

```powershell
nvm use 22
node -v
```

## Install dependencies

```powershell
npm install
```

## Configure local variables

Create the local dotenv file:

```powershell
Copy-Item functions/.env.example functions/.env.local
```

Optional test-specific overrides:

```powershell
Copy-Item functions/.env.example functions/.env.test.local
```

New cleanup-related variables available locally:

- `UIDL_RETENTION_DAYS`
- `UIDL_MINIMUM_RETAINED_COUNT`
- `UIDL_CLEANUP_BATCH_SIZE`

## Build and test

```powershell
npm run build --workspace functions
npm run test --workspace functions
```

## Run formatting and lint locally

```powershell
npm run lint
npm run format:check
```

## Start Firebase emulators

```powershell
npm run emulators
```

Configured ports:

- Functions emulator: `5001`
- Firestore emulator: `8080`

## Simulate the scheduled job locally

```powershell
npm run build --workspace functions
node functions/lib/jobs/run-email-transfer-job-local.js
```

This runs the same application orchestration as the scheduled function, but from
the local entry point.

The local run also executes the UIDL cleanup phase after message processing.
