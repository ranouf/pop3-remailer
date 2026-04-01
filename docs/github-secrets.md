# GitHub Secrets

## Required deployment secrets

### Google and Firebase authentication

- `FIREBASE_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

### Application configuration

- `ENVIRONMENT_NAME`
- `SOURCE_PROVIDER`
- `SOURCE_EMAIL_ADDRESS`
- `POP3_HOST`
- `POP3_PORT`
- `POP3_USERNAME`
- `POP3_PASSWORD`
- `POP3_TLS`
- `POP3_TIMEOUT_MS`
- `POP3_MAX_MESSAGES_PER_RUN`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_USER_EMAIL`
- `GMAIL_TIMEOUT_MS`
- `GMAIL_MAX_IMPORT_RETRIES`
- `AMPLITUDE_API_KEY`

## Recommendation

Store everything as GitHub repository secrets to keep the deployment workflow
simple. If you prefer, non-sensitive values such as `ENVIRONMENT_NAME` can later
be migrated to repository variables.

## Important note about `FIREBASE_PROJECT_ID`

`FIREBASE_PROJECT_ID` is used by the GitHub workflow to select the deploy target
and to name the temporary dotenv file.

It is intentionally not written into the deployed dotenv file because Firebase
reserves `FIREBASE_*` environment variable names for internal use.
