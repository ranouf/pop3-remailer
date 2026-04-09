# Release Overview v1

## Summary

This release turns `pop3-remailer` into a complete production-ready solution
for a specific operational gap: when Gmail is no longer relied on to pull POP3
emails on its own, this project takes over the retrieval, import, monitoring,
and operations experience.

The platform now includes:

- a scheduled POP3-to-Gmail import pipeline on Firebase Functions v2
- bounded and incremental POP3 scanning to reduce mailbox read cost
- Firestore-backed deduplication and job history
- persisted job-run statistics
- a secured Angular operations dashboard on Firebase Hosting
- Firebase Authentication with Google Sign-In
- a unified deployment workflow that publishes Hosting, Functions, Firestore
  rules, Firestore indexes, and a GitHub release

## Highlights

- Replaced the old “let Gmail fetch POP3 mail for me” expectation with an
  explicit, controlled import service
- Added a Firebase Hosting operations dashboard built with Angular 21 and
  Tailwind CSS 4
- Secured dashboard access with Firebase Authentication and API-side email
  authorization against the configured Gmail user
- Added health checks, persisted statistics, recent executions, recent errors,
  and chart-based visibility
- Persisted job-run statistics after each transfer run so the API can serve a
  stored projection instead of recalculating everything on each request
- Optimized POP3 mailbox reads so the job no longer lists the full mailbox and
  then truncates it
- Added incremental stop heuristics to reduce repeated processing of already
  known messages
- Reduced scheduled execution frequency to every 15 minutes and constrained the
  backend to safer runtime limits
- Unified the monorepo quality gates with ESLint, Prettier, TypeScript, Vitest,
  and a 90% minimum coverage threshold
- Added a full local production-like stack through Firebase emulators for
  Hosting, Auth, Functions, Firestore, and Pub/Sub

## Operational notes

- Firestore remains backend-only and denies direct client access
- The web app talks to the API through Firebase Hosting rewrites
- The deployment workflow creates `functions/.env.<project-id>` from GitHub
  Secrets before deployment
- The dashboard only works for the Firebase-authenticated user whose email
  matches `config.gmail.userEmail`
- Pushes to `main` deploy the stack and create a GitHub release from this file

## Follow-up checklist

- Confirm Firebase Hosting is enabled
- Confirm Firebase Authentication is enabled with Google Sign-In
- Confirm the Firebase Web App is configured in the project
- Confirm GitHub Workload Identity Federation is configured
- Confirm Gmail OAuth refresh token is valid
- Confirm POP3 access is enabled on the Orange or Wanadoo mailbox
