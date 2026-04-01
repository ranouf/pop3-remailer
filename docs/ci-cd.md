# CI/CD

## Pull request validation

Workflow:

- [pull-request-validation.yml](C:\Users\CedricArnould\source\repos\pop3-remailer\.github\workflows\pull-request-validation.yml)

Trigger:

- `pull_request` on `main`

Checks:

- `lint`
- `prettier`
- `typecheck`
- `build`
- `test`

Artifacts:

- `functions-build`
- `coverage-report`

## Deployment

Workflow:

- [firebase-deploy.yml](C:\Users\CedricArnould\source\repos\pop3-remailer\.github\workflows\firebase-deploy.yml)

Trigger:

- `push` on `main`

Steps:

1. authenticate to Google Cloud using Workload Identity Federation
2. install dependencies in Node 20
3. generate a temporary `functions/.env.<project-id>` file from GitHub Secrets
4. build the project
5. deploy Functions and Firestore configuration with Firebase CLI
6. create a GitHub release using [OVERVIEW.md](C:\Users\CedricArnould\source\repos\pop3-remailer\OVERVIEW.md)

## Design choice

The project currently keeps runtime configuration in environment variables
because the codebase reads `process.env` directly. A later migration to Firebase
parameterized configuration or Secret Manager can be done without changing the
core domain and orchestration layers.
