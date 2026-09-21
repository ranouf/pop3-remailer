# Release Overview

## Summary

The active Orange-to-Gmail transfer now runs locally in the .NET IMAP Remailer
job. It imports new messages through the Gmail API, records confirmed transfers
and run history in SQLite, then moves confirmed messages to an Orange archive
folder. A Windows tray icon shows recent runs and lets the user override the
execution interval and batch size.

## Firebase client

Firebase Hosting continues to serve the Angular dashboard and Firebase
Functions continues to serve the secured HTTP API. The previous scheduled POP3
transfer is no longer exported. The dashboard's Firestore statistics are
historical and do not include runs from the local .NET job; the Windows tray
shows the current local run history.

## Deployment and validation

Pull requests validate the .NET solution and tests under `src/jobs`, plus the
Firebase client under `src/client`. Automatic Firebase deployment on `main`
runs only when `src/client/**` changes; manual dispatch remains available. The
Firebase workflow does not install or run the local Windows job.

The public `src/jobs/IMAPRemailer.Jobs/appsettings.json` lists the required
settings without real credentials. Local credentials belong in the ignored
`appsettings.Development.json`. See the root README for setup and execution
instructions.
