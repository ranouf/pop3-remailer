using System.Diagnostics;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Tray;

/// <summary>Keeps a notification icon visible while the user is signed in.</summary>
public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly IJobRunHistory history;
    private readonly IJobOverridesStore overridesStore;
    private readonly JobSettings settings;
    private readonly NotifyIcon icon;
    private readonly Icon readyIcon;
    private readonly Icon processingIcon;
    private readonly Icon errorIcon;
    private readonly Icon stoppedIcon;
    private readonly System.Windows.Forms.Timer refreshTimer;
    private SummaryForm? summary;
    private SummaryForm? fullWindow;
    private IReadOnlyList<JobRunSummary> recentRuns = [];
    private DateTimeOffset nextBackgroundStartAttemptUtc;
    private bool backgroundRunning;
    private bool refreshing;

    /// <summary>Creates the icon and starts periodic status refreshes.</summary>
    /// <param name="history">The persisted synchronization history.</param>
    /// <param name="overridesStore">The saved user settings.</param>
    /// <param name="settings">The job configuration.</param>
    public TrayApplicationContext(
        IJobRunHistory history,
        IJobOverridesStore overridesStore,
        JobSettings settings
    )
    {
        this.history = history;
        this.overridesStore = overridesStore;
        this.settings = settings;
        readyIcon = LoadIcon("remailer");
        processingIcon = LoadIcon("remailer-processing");
        errorIcon = LoadIcon("remailer-error");
        stoppedIcon = LoadIcon("remailer-stopped");
        var menu = new ContextMenuStrip();
        menu.Items.Add(
            "Open flyout",
            null,
            async (_, _) => await ShowSummaryAsync()
        );
        menu.Items.Add(
            "Open full window",
            null,
            async (_, _) => await ShowFullWindowAsync()
        );
        menu.Items.Add(
            "Paramètres…",
            CreateMenuIcon("\uE713"),
            async (_, _) => await ShowSettingsAsync()
        );
        menu.Items.Add(
            "Redémarrer la tâche de fond",
            CreateMenuIcon("\uE72C"),
            async (_, _) => await RestartBackgroundTaskAsync()
        );
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit icon", null, (_, _) => ExitThread());
        icon = new NotifyIcon
        {
            Icon = readyIcon,
            Text = "IMAP Remailer: checking status",
            ContextMenuStrip = menu,
            Visible = true,
        };
        icon.MouseClick += async (_, args) =>
        {
            if (args.Button == MouseButtons.Left)
            {
                await ShowSummaryAsync();
            }
        };
        refreshTimer = new System.Windows.Forms.Timer { Interval = 1_000 };
        refreshTimer.Tick += async (_, _) => await RefreshAsync();
        refreshTimer.Start();
        Application.Idle += OnApplicationIdle;
    }

    /// <inheritdoc />
    protected override void ExitThreadCore()
    {
        Application.Idle -= OnApplicationIdle;
        refreshTimer.Stop();
        refreshTimer.Dispose();
        icon.Visible = false;
        icon.ContextMenuStrip?.Dispose();
        icon.Dispose();
        readyIcon.Dispose();
        processingIcon.Dispose();
        errorIcon.Dispose();
        stoppedIcon.Dispose();
        summary?.Close();
        fullWindow?.Close();
        base.ExitThreadCore();
    }

    #region Private

    /// <summary>Loads the first status once the Windows message loop is ready.</summary>
    /// <param name="sender">The application event source.</param>
    /// <param name="eventArgs">The event arguments.</param>
    private async void OnApplicationIdle(object? sender, EventArgs eventArgs)
    {
        Application.Idle -= OnApplicationIdle;
        await RefreshAsync();
    }

    /// <summary>Reads the latest runs and updates the icon and open window.</summary>
    /// <returns>A task that completes after the status is displayed.</returns>
    private async Task RefreshAsync()
    {
        if (refreshing)
        {
            return;
        }

        refreshing = true;
        try
        {
            recentRuns = await history.GetRecentRunsAsync(
                5,
                CancellationToken.None
            );
            backgroundRunning = IsBackgroundRunning();
            if (
                !backgroundRunning
                && DateTimeOffset.UtcNow >= nextBackgroundStartAttemptUtc
            )
            {
                nextBackgroundStartAttemptUtc =
                    DateTimeOffset.UtcNow.AddMinutes(1);
                await RunScheduledTaskCommandAsync("/Run");
            }

            var latest = recentRuns.Count == 0 ? null : recentRuns[0];
            icon.Icon =
                !backgroundRunning ? stoppedIcon
                : latest?.Status == "Running" ? processingIcon
                : latest?.Status == "Failed" ? errorIcon
                : readyIcon;
            var state =
                !backgroundRunning ? "stopped"
                : latest?.Status == "Running" ? "processing"
                : latest?.Status == "Failed" ? "last run failed"
                : "waiting";
            icon.Text = latest is null
                ? $"IMAP Remailer: {state}"
                : $"IMAP Remailer: {state}; last {latest.StartedAtUtc.ToLocalTime():HH:mm}, {latest.SourceCount} read, {latest.DurationMs.GetValueOrDefault() / 1000:0.#} s";
            if (summary?.Visible == true || fullWindow?.Visible == true)
            {
                var runs = await history.GetRunsAsync(CancellationToken.None);
                if (summary?.Visible == true)
                {
                    await summary.UpdateHistoryAsync(backgroundRunning, runs);
                }

                if (fullWindow?.Visible == true)
                {
                    await fullWindow.UpdateHistoryAsync(
                        backgroundRunning,
                        runs
                    );
                }
            }
        }
        catch (Exception)
        {
            icon.Icon = errorIcon;
            icon.Text = "IMAP Remailer: status unavailable";
        }
        finally
        {
            refreshing = false;
        }
    }

    /// <summary>Opens the run flyout beside the notification icon.</summary>
    private async Task ShowSummaryAsync()
    {
        if (summary is null || summary.IsDisposed)
        {
            summary = new SummaryForm(history);
            summary.FormClosed += (_, _) => summary = null;
        }

        summary.SelectLatestRun();
        await summary.UpdateHistoryAsync(
            backgroundRunning,
            await history.GetRunsAsync(CancellationToken.None)
        );
        summary.ShowAt(Cursor.Position);
    }

    /// <summary>Opens the resizable history window with the same run data.</summary>
    private async Task ShowFullWindowAsync()
    {
        if (fullWindow is null || fullWindow.IsDisposed)
        {
            fullWindow = new SummaryForm(history, fullWindow: true);
            fullWindow.FormClosed += (_, _) => fullWindow = null;
        }

        await fullWindow.UpdateHistoryAsync(
            backgroundRunning,
            await history.GetRunsAsync(CancellationToken.None)
        );
        fullWindow.ShowWindow();
    }

    private async Task ShowSettingsAsync()
    {
        var overrides = await overridesStore.GetAsync(CancellationToken.None);
        using var form = new SettingsForm(settings, overrides);
        if (form.ShowDialog() == DialogResult.OK)
        {
            await overridesStore.SaveAsync(
                form.SelectedOverrides,
                CancellationToken.None
            );
        }
    }

    private async Task RestartBackgroundTaskAsync()
    {
        await RunScheduledTaskCommandAsync("/End");
        await Task.Delay(1_000);
        var exitCode = await RunScheduledTaskCommandAsync("/Run");
        if (exitCode != 0)
        {
            icon.ShowBalloonTip(
                5_000,
                "IMAP Remailer",
                "Impossible de redémarrer la tâche de fond.",
                ToolTipIcon.Error
            );
            return;
        }

        icon.ShowBalloonTip(
            3_000,
            "IMAP Remailer",
            "La tâche de fond a été redémarrée.",
            ToolTipIcon.Info
        );
        await RefreshAsync();
    }

    private static async Task<int> RunScheduledTaskCommandAsync(string command)
    {
        using var process = Process.Start(
            new ProcessStartInfo(
                "schtasks.exe",
                $"{command} /TN \"IMAP Remailer\""
            )
            {
                CreateNoWindow = true,
                UseShellExecute = false,
            }
        )!;
        await process.WaitForExitAsync();
        return process.ExitCode;
    }

    private static Bitmap CreateMenuIcon(string glyph)
    {
        var bitmap = new Bitmap(20, 20);
        using var graphics = Graphics.FromImage(bitmap);
        using var font = new Font("Segoe MDL2 Assets", 12);
        TextRenderer.DrawText(
            graphics,
            glyph,
            font,
            new Rectangle(0, 0, 20, 20),
            Color.FromArgb(51, 65, 85),
            TextFormatFlags.NoPadding
        );
        return bitmap;
    }

    /// <summary>Checks whether the dedicated background job still owns its mutex.</summary>
    /// <returns>True while the background process is alive.</returns>
    private static bool IsBackgroundRunning()
    {
        if (
            Mutex.TryOpenExisting(
                @"Local\IMAPRemailer.Background",
                out var mutex
            )
        )
        {
            mutex.Dispose();
            return true;
        }

        return false;
    }

    /// <summary>Loads one embedded multi-resolution notification icon.</summary>
    /// <param name="name">The asset name without the extension.</param>
    /// <returns>The icon ready for the notification area.</returns>
    private static Icon LoadIcon(string name)
    {
        using var stream =
            typeof(TrayApplicationContext).Assembly.GetManifestResourceStream(
                $"IMAPRemailer.Tray.Assets.{name}.ico"
            )!;
        return new Icon(stream);
    }

    #endregion
}
