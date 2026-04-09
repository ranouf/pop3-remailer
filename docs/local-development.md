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

Create the local backend dotenv file:

```powershell
Copy-Item functions/.env.example functions/.env.local
```

Optional test-specific overrides:

```powershell
Copy-Item functions/.env.example functions/.env.test.local
```

Useful retention-related variables:

- `UIDL_RETENTION_DAYS`
- `UIDL_MINIMUM_RETAINED_COUNT`
- `UIDL_CLEANUP_BATCH_SIZE`

## Build and test

```powershell
npm run build
npm run test
```

## Run formatting and lint locally

```powershell
npm run lint
npm run format:check
npm run typecheck
```

## Start backend-focused emulators

```powershell
npm run emulators
```

Configured ports:

- Hosting emulator: `5000`
- Functions emulator: `5001`
- Firestore emulator: `8080`
- Auth emulator: `9099`
- Pub/Sub emulator: `8085`

## Start the full local stack

```powershell
npm run start:local
```

This mode builds the backend and frontend, then starts:

- Hosting
- Auth
- Functions
- Firestore
- Pub/Sub

Open:

- [http://127.0.0.1:5000](http://127.0.0.1:5000)

This is the closest local approximation of the deployed production setup.

## Angular development server

```powershell
npm run start --workspace web
```

Open:

- [http://localhost:4200](http://localhost:4200)

This is convenient for fast frontend iteration, but it is not the most faithful
representation of deployed Hosting behavior.

## Simulate the scheduled job locally

```powershell
npm run build --workspace functions
node functions/lib/jobs/run-email-transfer-job-local.js
```

This runs the same transfer orchestration as the scheduled function from a
local entry point.
