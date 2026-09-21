# CI/CD

## Pull request validation

Workflow:

- [pull-request-validation.yml](../../../.github/workflows/pull-request-validation.yml)

Trigger:

- `pull_request` on `main`

Checks:

- `dotnet-format-build-test` (the solution, tests, and coverage under `src/jobs`)
- `lint`
- `prettier`
- `typecheck`
- `build`
- `test-and-coverage`

Artifacts:

- `functions-build`
- `coverage-report`

Notes:

- .NET validation runs from the repository root; client checks run in
  `src/client`
- coverage artifacts include both:
  - `src/client/functions/coverage`
  - `src/client/web/coverage`

## Deployment

Workflow:

- [firebase-deploy.yml](../../../.github/workflows/firebase-deploy.yml)

Triggers:

- `push` on `main` when `src/client/**` changes
- `workflow_dispatch`

What it does:

1. authenticate to Google Cloud using Workload Identity Federation
2. install dependencies in Node 22
3. generate `functions/.env.<project-id>` from GitHub Secrets
4. build the Firebase client
5. validate Firestore rules safety
6. deploy Firebase Hosting
7. deploy Firebase Functions
8. deploy Firestore rules
9. deploy Firestore indexes
10. create a GitHub release using [OVERVIEW.md](../OVERVIEW.md)

The Firebase deployment does not publish or run the local .NET job. Its
Firestore dashboard statistics remain separate from the local SQLite run
history shown by the Windows tray.

## Design choice

Runtime configuration is still environment-variable based.

This keeps deployment simple while preserving a clean separation between:

- core application logic
- infrastructure adapters
- deployment-specific configuration concerns

A later migration to Firebase parameterized configuration or Secret Manager can
be done without redesigning the main business flow.
