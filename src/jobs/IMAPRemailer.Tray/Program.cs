using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Infrastructure.Persistence;
using IMAPRemailer.Tray;
using Microsoft.Extensions.Configuration;

// The tray reads the same published database settings as the background job.
var settingsDirectory = args.Length == 0 ? AppContext.BaseDirectory : args[0];
var environment =
    Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Production";
var configuration = new ConfigurationBuilder()
    .SetBasePath(settingsDirectory)
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile($"appsettings.{environment}.json", optional: true)
    .AddEnvironmentVariables()
    .Build();
var settings = configuration
    .GetRequiredSection("SqliteSettings")
    .Get<SqliteSettings>()!;
var jobSettings = configuration
    .GetRequiredSection("JobSettings")
    .Get<JobSettings>()!;

ApplicationConfiguration.Initialize();
if (args.Length == 0 || (args.Length > 1 && args[1] == "--preview"))
{
    var history = new SqliteJobRunHistory(settings, jobSettings);
    using var preview = new SummaryForm(history, fullWindow: args.Length == 0);
    if (args.Length > 0)
    {
        preview.StartPosition = FormStartPosition.CenterScreen;
        preview.ShowInTaskbar = true;
        preview.FormBorderStyle = FormBorderStyle.FixedSingle;
    }
    preview.Shown += async (_, _) =>
    {
        var runs = await history.GetRunsAsync(CancellationToken.None);
        var backgroundRunning = Mutex.TryOpenExisting(
            @"Local\IMAPRemailer.Background",
            out var backgroundMutex
        );
        backgroundMutex?.Dispose();
        await preview.UpdateHistoryAsync(backgroundRunning, runs);
    };
    Application.Run(preview);
    return;
}

using var singleInstance = new Mutex(
    true,
    @"Local\IMAPRemailer.Tray",
    out var isFirstInstance
);
if (isFirstInstance)
{
    Application.Run(
        new TrayApplicationContext(
            new SqliteJobRunHistory(settings, jobSettings),
            new SqliteJobOverridesStore(settings),
            jobSettings
        )
    );
}
