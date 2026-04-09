# Gmail API Configuration

## Goal

The application imports RFC822 email messages into Gmail with OAuth2.

You must configure:

- a Google Cloud project
- the Gmail API
- an OAuth consent screen
- an OAuth client
- a refresh token for the target Gmail account

## 1. Create or select a Google Cloud project

URL:

- https://console.cloud.google.com/projectcreate

Action:

- create a dedicated project, for example `pop3-remailer`
- select that project in Google Cloud Console

## 2. Enable the Gmail API

URL:

- https://console.cloud.google.com/apis/library/gmail.googleapis.com

Action:

- click `Enable`

## 3. Configure the OAuth consent screen

URL:

- https://console.cloud.google.com/apis/credentials/consent

Action:

- choose `External`
- fill the minimum required fields
- add the Gmail account you want to use in `Test users` when needed

Important note:

- if the OAuth app stays in `Testing`, Google can issue refresh tokens that
  expire after 7 days for some configurations
- for a durable setup, review your OAuth publishing state and Google OAuth
  policies

Official reference:

- https://developers.google.com/identity/protocols/oauth2

## 4. Create the OAuth client

URL:

- https://console.cloud.google.com/apis/credentials

Action:

- click `Create credentials`
- choose `OAuth client ID`
- choose `Web application`
- add the following authorized redirect URI:
  - `https://developers.google.com/oauthplayground`

Then keep:

- `Client ID`
- `Client Secret`

These values are used in:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`

## 5. Generate the refresh token

URL:

- https://developers.google.com/oauthplayground/

Action:

1. Click the settings icon in the top right corner.
2. Enable `Use your own OAuth credentials`.
3. Paste your `Client ID`.
4. Paste your `Client Secret`.
5. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.insert`
   - `https://www.googleapis.com/auth/gmail.readonly`
6. Click `Authorize APIs`.
7. Sign in with the Gmail account used as the destination mailbox.
8. Accept the requested permissions.
9. Click `Exchange authorization code for tokens`.
10. Copy the `refresh_token`.

These scopes are required because the application:

- imports messages with Gmail import
- performs Gmail lookup operations during reconciliation

Official scope reference:

- https://developers.google.com/workspace/gmail/api/auth/scopes

## 6. Update local and deployment configuration

Add the values to:

- `functions/.env.local`
- GitHub Secrets for deployment

Required variables:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_USER_EMAIL`

## Important note about refresh token rotation

Google does not always return a new `refresh_token` on repeated authorization
flows.

If the OAuth Playground does not return a refresh token:

1. Open:
   - https://myaccount.google.com/permissions
2. Find the application linked to your Google Cloud OAuth client.
3. Revoke access.
4. Run the OAuth Playground flow again from the beginning.

This often forces Google to issue a new refresh token.

## Troubleshooting

### `invalid_grant`

Possible causes:

- the refresh token was revoked
- the OAuth app is still in testing and the token expired
- the Gmail account changed its granted permissions

### Gmail import fails but OAuth seems valid

Check:

- that `GMAIL_USER_EMAIL` matches the authorized Gmail account
- that the Gmail API is enabled in the same Google Cloud project as the OAuth
  client
- that the OAuth client ID and secret belong to the same project

### Scope mismatch

If you generated a refresh token without the required scopes, generate a new
one with:

- `https://www.googleapis.com/auth/gmail.insert`
- `https://www.googleapis.com/auth/gmail.readonly`
