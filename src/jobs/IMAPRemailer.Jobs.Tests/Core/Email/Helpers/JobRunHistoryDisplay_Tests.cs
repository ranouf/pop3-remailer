using IMAPRemailer.Core.Email.Helpers;
using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Jobs.Tests.Core.Email.Helpers;

public sealed class JobRunHistoryDisplay_Tests
{
    [Fact]
    public void GetCompactRuns_keeps_only_the_latest_runs()
    {
        var runs = Enumerable
            .Range(1, JobRunHistoryDisplay.CompactFlyoutCapacity + 1)
            .Select(CreateRun)
            .ToArray();

        var displayedRuns = JobRunHistoryDisplay.GetCompactRuns(runs);

        Assert.Equal(
            JobRunHistoryDisplay.CompactFlyoutCapacity,
            displayedRuns.Count
        );
        Assert.Equal(2, displayedRuns[0].Id);
        Assert.Equal(runs[^1], displayedRuns[^1]);
    }

    private static JobRunSummary CreateRun(int id) =>
        new(
            id,
            DateTimeOffset.UnixEpoch.AddMinutes(id),
            DateTimeOffset.UnixEpoch.AddMinutes(id + 1),
            false,
            "Completed",
            20,
            20,
            0,
            0,
            1_000,
            null
        );
}
