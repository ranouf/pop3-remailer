using Cronos;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Infrastructure.Email;
using IMAPRemailer.Infrastructure.Persistence;
using IMAPRemailer.Jobs.Runtime;
using IMAPRemailer.Jobs.Triggers;
using MailKit.Net.Imap;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

// Select the requested run mode before creating the host.
var mode = args.FirstOrDefault() ?? "--background";
if (
    mode
    is not (
        "--background"
        or "--once"
        or "--dry-run"
        or "--check-imap"
        or "--check-gmail"
    )
)
{
    Console.Error.WriteLine(
        "Usage: IMAPRemailer.Jobs [--background|--once|--dry-run|--check-imap|--check-gmail]"
    );
    return 2;
}

if (
    mode == "--background"
    && Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") is null
)
{
    Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", "Development");
}

var builder = Host.CreateApplicationBuilder(args);

// Use the computer's local time for single-line interactive and scheduled logs.
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.UseUtcTimestamp = false;
    options.TimestampFormat = "yyyy-MM-dd HH:mm:ss.fff ";
});

// Load the published settings, the current environment, then environment overrides.
builder.Configuration.SetBasePath(AppContext.BaseDirectory);
builder.Configuration.AddJsonFile("appsettings.json", optional: false);
builder.Configuration.AddJsonFile(
    $"appsettings.{builder.Environment.EnvironmentName}.json",
    optional: true
);
builder.Configuration.AddEnvironmentVariables();

// Job schedule and per-run message limit.
var jobSettings = builder
    .Configuration.GetRequiredSection("JobSettings")
    .Get<JobSettings>()!;
builder.Services.AddSingleton(jobSettings);
builder.Services.AddSingleton(
    CronExpression.Parse(jobSettings.Cron, CronFormat.IncludeSeconds)
);

// Orange IMAP source.
builder.Services.AddSingleton(
    builder
        .Configuration.GetRequiredSection("OrangeSettings")
        .Get<OrangeSettings>()!
);
builder.Services.AddSingleton<IEmailSourceService>(
    services => new OrangeImapSourceService(
        services.GetRequiredService<OrangeSettings>(),
        services.GetRequiredService<JobSettings>(),
        services.GetRequiredService<IJobOverridesStore>(),
        () => new ImapClient()
    )
);

// Gmail destination.
builder.Services.AddSingleton(
    builder
        .Configuration.GetRequiredSection("GmailSettings")
        .Get<GmailSettings>()!
);
builder.Services.AddSingleton(new HttpClient());
builder.Services.AddSingleton<
    IEmailDestinationService,
    GmailDestinationService
>();

// SQLite state keeps confirmed imports across runs.
var sqliteSettings = builder
    .Configuration.GetRequiredSection("SqliteSettings")
    .Get<SqliteSettings>()!;
using var backgroundLog =
    mode == "--background"
        ? new StreamWriter(
            Path.Combine(
                Directory
                    .CreateDirectory(
                        Path.Combine(
                            Path.GetDirectoryName(sqliteSettings.DatabasePath)!,
                            "logs"
                        )
                    )
                    .FullName,
                $"{DateTime.Now:yyyy-MM-dd_HH-mm-ss}.log"
            )
        )
        {
            AutoFlush = true,
        }
        : null;
if (backgroundLog is not null)
{
    Console.SetOut(backgroundLog);
}
builder.Services.AddSingleton(sqliteSettings);
builder.Services.AddSingleton<IJobOverridesStore>(
    new SqliteJobOverridesStore(sqliteSettings)
);
var runLogContext = new RunLogContext();
var runHistory = new SqliteJobRunHistory(sqliteSettings, jobSettings);
builder.Services.AddSingleton(runLogContext);
builder.Services.AddSingleton<ITransferState, SqliteTransferState>();
builder.Services.AddSingleton<IJobRunHistory>(runHistory);
builder.Logging.AddProvider(
    new SqliteRunLogProvider(runHistory, runLogContext)
);

// The manager owns the transfer workflow and logs its timings; Jobs schedules it.
builder.Services.AddSingleton<IEmailManager, EmailManager>();
builder.Services.AddSingleton<CronTransferTrigger>();
builder.Services.AddSingleton<TransferRuntime>();

using var host = builder.Build();

// Connection checks and one-off runs exit; background mode waits for cron ticks.
try
{
    switch (mode)
    {
        case "--check-imap":
            await host
                .Services.GetRequiredService<IEmailSourceService>()
                .CheckAsync(CancellationToken.None);
            Console.WriteLine("IMAP authentication succeeded.");
            break;
        case "--check-gmail":
            await host
                .Services.GetRequiredService<IEmailDestinationService>()
                .CheckAsync(CancellationToken.None);
            Console.WriteLine("Gmail access succeeded.");
            break;
        case "--once":
            await host
                .Services.GetRequiredService<CronTransferTrigger>()
                .ExecuteAsync(CancellationToken.None);
            break;
        case "--dry-run":
            await host
                .Services.GetRequiredService<CronTransferTrigger>()
                .ExecuteAsync(CancellationToken.None, dryRun: true);
            break;
        default:
        {
            using var backgroundMutex = new Mutex(
                true,
                @"Local\IMAPRemailer.Background",
                out var isFirstInstance
            );
            if (!isFirstInstance)
            {
                Console.Error.WriteLine(
                    "The background job is already running."
                );
                return 1;
            }

            using var shutdown = new CancellationTokenSource();
            Console.CancelKeyPress += (_, eventArgs) =>
            {
                eventArgs.Cancel = true;
                shutdown.Cancel();
            };
            await host
                .Services.GetRequiredService<TransferRuntime>()
                .RunAsync(shutdown.Token);
            break;
        }
    }

    return 0;
}
catch (Exception exception)
{
    Console.Error.WriteLine(exception.Message);
    return 1;
}
