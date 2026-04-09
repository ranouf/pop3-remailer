# Firebase Setup

## Required project setup

1. Create a Firebase project.
2. Upgrade the project to the Blaze plan.
3. Enable Cloud Firestore in Native mode.
4. Enable Firebase Hosting.
5. Enable Firebase Authentication.
6. Enable Google Sign-In under Authentication providers.
7. Create a Firebase Web App for the project.
8. Confirm the project is deployed with Functions v2 and runtime `nodejs22`.

## Local CLI setup

```powershell
npm install --global firebase-tools
firebase login
firebase use <project-id>
```

You can also pass `--project <project-id>` on each deploy command instead of
storing a local alias.

## Project files

- [firebase.json](../firebase.json)
- [firestore.rules](../firestore.rules)
- [firestore.indexes.json](../firestore.indexes.json)

## Hosting and API routing

Firebase Hosting serves the Angular application from:

- `web/dist/web/browser`

Hosting also rewrites API requests to the deployed `api` function:

- `/statistics`
- `/healthcheck`

All other routes are redirected to `index.html` so Angular routing works
correctly.

## Authentication notes

- the web app uses Firebase Authentication with Google Sign-In
- the backend API accepts Firebase bearer tokens
- the API then authorizes access only when the authenticated email matches the
  configured Gmail user email

## Notes

- the project intentionally targets `nodejs22`
- the scheduler job is created automatically when the scheduled function is
  deployed
- do not manually edit or delete the generated scheduler job from Google Cloud
  unless you intentionally want to replace the deployed definition
