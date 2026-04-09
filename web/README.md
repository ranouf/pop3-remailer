# Web

This workspace contains the Angular operations dashboard deployed on Firebase
Hosting.

## Purpose

The web app provides an authenticated view over the POP3-to-Gmail import
service. It is the operational surface for:

- health checks
- persisted statistics
- recent executions
- recent errors
- daily trend charts

## Authentication

- Firebase Authentication with Google Sign-In is used in production
- the backend API only authorizes access when the Firebase-authenticated email
  matches the configured Gmail user email
- local full-stack mode uses the Firebase Auth emulator

## Development

Start the Angular development server:

```bash
npm run start --workspace web
```

Then open:

- [http://localhost:4200](http://localhost:4200)

## Production-like local mode

To run the full local stack through Firebase emulators, start from the
repository root:

```bash
npm run start:local
```

Then open:

- [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Commands

```bash
npm run lint --workspace web
npm run format:check --workspace web
npm run typecheck --workspace web
npm run build --workspace web
npm run test --workspace web -- --watch=false
npm run coverage --workspace web
```

## Tech stack

- Angular 21
- Tailwind CSS 4
- Firebase Web SDK
- Chart.js via `ng2-charts`
- Vitest
