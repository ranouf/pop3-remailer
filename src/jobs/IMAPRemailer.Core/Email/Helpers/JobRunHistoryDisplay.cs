using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Core.Email.Helpers;

/// <summary>Selects the run history that fits in the compact tray flyout.</summary>
public static class JobRunHistoryDisplay
{
    /// <summary>The number of recent runs displayed in the compact flyout.</summary>
    public const int CompactFlyoutCapacity = 350;

    /// <summary>Returns the most recent runs in chronological order.</summary>
    /// <param name="runs">All retained runs, oldest first.</param>
    public static IReadOnlyList<JobRunSummary> GetCompactRuns(
        IReadOnlyList<JobRunSummary> runs
    ) => runs.Skip(Math.Max(0, runs.Count - CompactFlyoutCapacity)).ToArray();
}
