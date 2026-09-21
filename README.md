# IMAP Remailer

Le projet Firebase et son interface Angular se trouvent dans `src/client`.
La synchronisation locale C# se trouve dans `src/jobs/IMAPRemailer.sln`.
Le tableau de bord Firebase conserve les statistiques historiques de Firestore;
les nouvelles exécutions locales sont enregistrées dans SQLite et affichées
dans l'icône Windows, sans synchronisation vers ce tableau de bord.

La solution suit la séparation du projet AirInuit : `IMAPRemailer.Core` définit `IEmailSourceService`, `IEmailDestinationService`, `ITransferState`, `IJobRunHistory` et `IEmailManager`. Son `EmailManager` orchestre le transfert sans dépendre des fournisseurs; le helper statique `Email/Helpers/TransferMetricsHelper` mesure les étapes et écrit leur durée dans les logs. `IMAPRemailer.Infrastructure` fournit `OrangeImapSourceService`, `GmailDestinationService` et les stockages SQLite; `IMAPRemailer.Jobs` contient `Program`, `Triggers` et `Runtime`. `IMAPRemailer.Tray` affiche l'état de la job dans la zone de notification Windows.

## Règles de code

Les projets C# reprennent les conventions AirInuit : `.editorconfig`, CSharpier 1.2.6, analyseurs .NET, validation du style au build et SDK .NET 10. La règle `IDE0011` impose les accolades après chaque `if` et fait échouer le build en cas d'écart. Le contrôle exécuté en CI est :

Dans chaque classe C#, les méthodes publiques précèdent les méthodes privées. Toutes les méthodes privées sont regroupées dans `#region Private` / `#endregion` à la fin de la classe.

```powershell
dotnet tool restore
dotnet csharpier check src/jobs
dotnet build src/jobs/IMAPRemailer.sln --configuration Release /warnaserror
dotnet test src/jobs/IMAPRemailer.sln --collect:"XPlat Code Coverage" --settings src/jobs/coverage.runsettings
```

Pour formater les fichiers C#, utiliser `dotnet csharpier format src/jobs`. Le client Angular/Firebase conserve ses commandes ESLint et Prettier dans `src/client/package.json`.

## Configuration

Comme dans AirInuit, `Program.cs` charge `src/jobs/IMAPRemailer.Jobs/appsettings.json`, puis `appsettings.Development.json` lorsque `DOTNET_ENVIRONMENT=Development`, puis les variables d'environnement. La configuration est divisée en quatre sections : `OrangeSettings` (hôte IMAP, port 993, identifiants et dossier `Transferred to Gmail`), `GmailSettings` (OAuth et adresse cible), `SqliteSettings` (fichier local) et `JobSettings` (cron et limite par run). Le fichier Development, ignoré par Git, contient les secrets locaux. Les variables d'environnement reprennent les clés hiérarchiques avec `__`, par exemple `JobSettings__MaxMessagesPerRun`. La webjob C# ne lit plus le fichier `.env.local` du client Firebase.

Le fichier suivi par Git contient toutes les clés et des valeurs non secrètes : `imap.orange.fr`, le port TLS 993, le délai de 15 secondes, le dossier d'archivage, la base SQLite et la planification. Pour une installation locale, créez `src/jobs/IMAPRemailer.Jobs/appsettings.Development.json` avec les sections `OrangeSettings` et `GmailSettings` : renseignez l'adresse et le mot de passe Orange (`Username`, `Password`), puis les identifiants OAuth Gmail (`ClientId`, `ClientSecret`, `RefreshToken`) et l'adresse cible (`UserEmail`). Ce fichier est ignoré par Git et ses valeurs remplacent celles de `appsettings.json`. Lancez les commandes depuis la racine du dépôt pour que le chemin SQLite relatif `src/jobs/data/state.db` soit résolu correctement. L'application se connecte directement à Orange en IMAP avec TLS; elle ne configure pas de VPN.

La clé `JobSettings:Cron` accepte une expression cron à six champs avec secondes, interprétée dans le fuseau horaire local du PC. La valeur livrée, `0 */5 * * * *`, lance une synchronisation toutes les cinq minutes. `JobSettings:RunRetentionDays` conserve l'historique pendant sept jours par défaut. Les runs expirés et leurs logs sont supprimés au démarrage du prochain run; aucune purge ne se produit pendant que la synchronisation reste inactive.

Les identifiants IMAP (UIDVALIDITY et UID) des messages confirmés dans Gmail sont enregistrés dans la base SQLite `src/jobs/data/state.db`, ignorée par Git. La clé `SqliteSettings:DatabasePath` permet de choisir un autre emplacement. Les anciens UIDL restent dans cette base pour préserver l'historique; l'ancien `state.json` est importé au premier démarrage puis renommé en `state.json.migrated`. Sauvegardez `state.db` si la synchronisation est déplacée vers un autre PC.

Les tests de `src/jobs/IMAPRemailer.Jobs.Tests` suivent la convention AirInuit `*_Tests.cs` et couvrent le service IMAP via un serveur TLS local, l'API Gmail simulée, l'orchestration et SQLite. La CI impose 100 % des lignes et des branches du code utile. `src/jobs/IMAPRemailer.Jobs/Program.cs` est exclu de la mesure : il assemble les services et traite les arguments de ligne de commande. Le projet `IMAPRemailer.Tray` est également exclu de la couverture unitaire : son affichage et ses événements Windows sont validés visuellement. Les fichiers générés par .NET et le code des tests ne font pas partie du périmètre de production mesuré.

## Vérifications et exécution

Depuis la racine du projet :

```powershell
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet run --project src/jobs/IMAPRemailer.Jobs -- --check-imap
dotnet run --project src/jobs/IMAPRemailer.Jobs -- --check-gmail
dotnet run --project src/jobs/IMAPRemailer.Jobs -- --dry-run
dotnet run --project src/jobs/IMAPRemailer.Jobs -- --once
```

`--dry-run` lit les courriels et vérifie les identifiants RFC 822 dans Gmail sans importer ni déplacer de message. `--once` traite au plus `JobSettings:MaxMessagesPerRun` messages de la boîte de réception Orange, en commençant par les plus récents. La valeur par défaut est `10` dans les appsettings; le code et les scripts n'imposent pas d'autre plafond. Pour accélérer le traitement du reste, augmentez cette valeur, par exemple à `100`, après la phase de test. La tâche Windows charge `appsettings.Development.json`, dont la valeur prévaut sur `appsettings.json`; modifiez donc la valeur Development, puis relancez `Install-ScheduledTask.ps1` pour republier les paramètres. Le manager recherche le `Message-ID` dans Gmail avant chaque import; après confirmation de Gmail, il marque le message dans SQLite puis le déplace dans le dossier Orange `Transferred to Gmail`. Si le déplacement échoue, le prochain run le reprend sans réimporter. Une erreur d'import laisse le message dans la boîte de réception. Les appels Gmail visent directement `GmailSettings:UserEmail`; `--check-gmail` reste une vérification manuelle explicite.

## Exécution en arrière-plan

Depuis PowerShell, avec la session Windows qui possède les paramètres locaux :

```powershell
./src/jobs/Install-ScheduledTask.ps1
```

Le script publie les exécutables, retire l'ancienne tâche `POP3 Remailer` et crée deux tâches Windows : `IMAP Remailer` pour la synchronisation et `IMAP Remailer Tray` pour l'icône. Elles démarrent à l'ouverture de session avec l'environnement Development; le runtime applique ensuite l'horaire et la limite des appsettings. Les commandes manuelles lisent la même limite. Les journaux horodatés sont dans `src/jobs/data/logs`, avec les étapes Gmail, IMAP et SQLite et les marqueurs `JOB_RUN_STARTED`, `JOB_RUN_COMPLETED` et `JOB_RUN_FAILED`. L'ancienne fonction Firebase planifiée n'est plus exportée; l'API web reste présente dans `src/client`.

## Icône de la zone de notification

L'icône personnalisée représente une enveloppe. Son point est vert quand le service attend, orange pendant un run, rouge après un échec et gris si le service est arrêté. Le survol montre un résumé court. Un clic ouvre le **flyout** au-dessus de l'icône; le menu contextuel propose aussi **Open full window**, une fenêtre d'historique redimensionnable. Les deux affichent tous les runs conservés, du plus ancien au plus récent, avec le dernier ouvert par défaut. Un seul run est ouvert à la fois. Il affiche ses comptes, sa durée et ses logs; les nouveaux logs apparaissent chaque seconde pendant un run. Le défilement reste au bas des logs jusqu'à ce que vous le déplaciez manuellement. Les informations sont noires, les avertissements orange et les erreurs rouges sur fond blanc. Un run en échec porte un indicateur rouge et affiche son erreur. Le bouton de suppression d'un run terminé efface aussi ses logs après confirmation. Le menu contextuel permet enfin de fermer seulement l'icône. La job continue de fonctionner si l'icône est fermée.

L'historique est enregistré dans les tables SQLite `job_runs` et `job_run_logs`, à côté de `imported_messages`. La job et l'icône ouvrent chacune leur propre connexion. Les runs antérieurs à cette version conservent leurs statistiques, mais n'ont pas de logs enregistrés dans SQLite. Un run commencé puis abandonné est affiché comme interrompu et peut être supprimé. Windows peut placer l'icône dans le menu des icônes masquées; elle peut être épinglée dans la zone visible depuis les paramètres de la barre des tâches. Pour relancer uniquement l'icône dans la session courante, exécuter `./src/jobs/Run-Tray.ps1`.

`Run-Background.ps1` et `Run-Once.ps1` affichent aussi leurs logs dans la console lorsqu'ils sont lancés manuellement. La tâche Windows reste masquée; pour suivre ses logs dans une console sans démarrer une seconde synchronisation, utilisez :

```powershell
$log = Get-ChildItem src/jobs/data/logs/*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content $log.FullName -Wait
```

## Durées dans les journaux

Chaque run écrit des lignes `TIMING` dans les journaux et dans la console lors d'un lancement manuel. `TotalDurationMs` et `RunStatus` indiquent la durée totale et le succès ou l'échec; le log `Source returned` indique le nombre de messages récupérés et `Synchronization completed` résume les résultats. `DurationMs` mesure `SourceRead`, `StateLookup`, `DestinationLookup`, `DestinationImport`, `StateWrite` et `SourceArchive`. Chaque courriel possède aussi sa durée totale, son identifiant source et son résultat (`Imported`, `AlreadyPresent`, `Pending` ou `Failed`). Les durées sont écrites même lorsqu'une opération échoue.
