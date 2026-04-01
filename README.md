# pop3-remailer

Foundation for a Firebase Functions v2 project that imports messages from a
POP3S mailbox into Gmail with strict UIDL-based deduplication.

## Current status

Step 1 establishes the project foundation:

- Node.js 20 is the only supported runtime for local development, tests, CI,
  and Firebase Functions.
- Firebase Functions v2 is the target deployment platform.
- TypeScript, ESLint, Prettier, Vitest, and Firebase project files are in
  place.

## Local prerequisite

Use Node.js `20.19.1` before running any project command.

```powershell
nvm use 20.19.1
npm install
npm run verify
```
