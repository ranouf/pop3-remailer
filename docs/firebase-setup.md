# Firebase Setup

## Required project setup

1. Create a Firebase project.
2. Upgrade the project to the Blaze plan.
3. Enable Cloud Firestore in Native mode.
4. Enable Cloud Scheduler for scheduled functions.
5. Confirm the project is deployed with Functions v2 and runtime `nodejs20`.

## Local CLI setup

```powershell
npm install --global firebase-tools
firebase login
firebase use <project-id>
```

You can also pass `--project <project-id>` on each deploy command instead of
storing a local alias.

## Project files

- [firebase.json](C:\Users\CedricArnould\source\repos\pop3-remailer\firebase.json)
- [firestore.rules](C:\Users\CedricArnould\source\repos\pop3-remailer\firestore.rules)
- [firestore.indexes.json](C:\Users\CedricArnould\source\repos\pop3-remailer\firestore.indexes.json)

## Notes

- The project intentionally targets `nodejs20`.
- The scheduler job is created automatically when the scheduled function is
  deployed.
- Do not manually edit or delete the generated scheduler job from the Google
  Cloud console unless you are intentionally replacing the deployment.
