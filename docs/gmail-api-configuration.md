# Gmail API Configuration

## Goal

The application imports RFC822 messages into Gmail without sending them.

## Required Google Cloud setup

1. Open Google Cloud Console for the target Gmail account project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 client.
5. Generate a refresh token for the Gmail mailbox used as destination.

## Required scope

The project uses:

- `https://www.googleapis.com/auth/gmail.insert`

This scope is intentionally narrower than mail-sending scopes because the
application imports messages and does not send them.

## Required secrets

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_USER_EMAIL`
- `GMAIL_TIMEOUT_MS`
- `GMAIL_MAX_IMPORT_RETRIES`

## Notes

- The Gmail account must be the same account targeted by `GMAIL_USER_EMAIL`.
- If the refresh token is revoked, Gmail imports will fail until a new token is
  issued.
- The code preserves the raw email payload and imports it as MIME content.
