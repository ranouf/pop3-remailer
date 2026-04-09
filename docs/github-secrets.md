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
- `UIDL_RETENTION_DAYS`
- `UIDL_MINIMUM_RETAINED_COUNT`
- `UIDL_CLEANUP_BATCH_SIZE`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_USER_EMAIL`
- `GMAIL_TIMEOUT_MS`
- `GMAIL_MAX_IMPORT_RETRIES`
- `AMPLITUDE_API_KEY`

## Recommendation

Store all deployment inputs as GitHub repository secrets to keep the workflow
simple and reproducible. Non-sensitive values can be migrated later to
repository variables if you want a stricter separation.

## Important note about project identifiers

`FIREBASE_PROJECT_ID` is used by the GitHub workflow to:

- select the deployment target
- name the generated Firebase dotenv file

The workflow also writes:

- `APP_FIREBASE_PROJECT_ID`

into the generated deployment dotenv file so the application can reliably read
its project identifier at runtime without depending on reserved Firebase
environment variable names.
