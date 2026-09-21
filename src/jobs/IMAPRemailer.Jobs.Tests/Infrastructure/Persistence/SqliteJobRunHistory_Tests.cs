using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Core.Email.Models;
using IMAPRemailer.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Persistence;

public sealed class SqliteJobRunHistory_Tests : BaseTest
{
    [Fact]
    public async Task Runs_Should_Persist_Status_Totals_And_Recent_Order()
    {
        var settings = CreateSqliteSettings();
        var jobSettings = new JobSettings("0 0 * * * *", 2);
        Assert.Equal("0 0 * * * *", jobSettings.Cron);
        var history = new SqliteJobRunHistory(settings, jobSettings);
        var runningId = await history.StartRunAsync(
            true,
            CancellationToken.None
        );
        var running = Assert.Single(
            await history.GetRecentRunsAsync(5, CancellationToken.None)
        );
        Assert.Equal("Running", running.Status);
        Assert.Equal(TimeSpan.Zero, running.StartedAtUtc.Offset);
        Assert.True(running.DryRun);
        Assert.Null(running.CompletedAtUtc);
        Assert.Null(running.DurationMs);
        Assert.Null(running.Error);

        await history.CompleteRunAsync(
            runningId,
            new JobRunResult(
                false,
                2,
                0,
                1,
                1,
                TimeSpan.FromSeconds(3),
                "Test failure"
            ),
            CancellationToken.None
        );
        for (var index = 0; index < 5; index++)
        {
            var runId = await history.StartRunAsync(
                false,
                CancellationToken.None
            );
            await history.CompleteRunAsync(
                runId,
                new JobRunResult(
                    true,
                    2,
                    1,
                    1,
                    0,
                    TimeSpan.FromSeconds(4),
                    null
                ),
                CancellationToken.None
            );
        }

        var recent = await new SqliteJobRunHistory(
            settings,
            jobSettings
        ).GetRecentRunsAsync(5, CancellationToken.None);
        Assert.Equal(5, recent.Count);
        Assert.Equal("Completed", recent[0].Status);
        Assert.Equal(2, recent[0].SourceCount);
        Assert.Equal(1, recent[0].Imported);
        Assert.Equal(1, recent[0].AlreadyPresent);
        Assert.Equal(0, recent[0].Pending);
        Assert.Equal(4000, recent[0].DurationMs);
        Assert.Null(recent[0].Error);
        Assert.All(recent, run => Assert.NotNull(run.CompletedAtUtc));
        Assert.True(
            recent
                .Zip(recent.Skip(1), (newer, older) => newer.Id > older.Id)
                .All(value => value)
        );

        var all = await history.GetRecentRunsAsync(6, CancellationToken.None);
        Assert.Equal("Failed", all[^1].Status);
        Assert.Equal("Test failure", all[^1].Error);
        Assert.Equal(1, all[^1].Pending);
        Assert.Equal(3000, all[^1].DurationMs);
    }

    [Fact]
    public async Task Logs_Should_Be_Ordered_And_Deleted_With_Their_Run()
    {
        var settings = CreateSqliteSettings();
        var history = new SqliteJobRunHistory(settings, CreateJobSettings());
        var first = await history.StartRunAsync(false, CancellationToken.None);
        history.AppendLog(first, "Information", "First message");
        history.AppendLog(first, "Warning", "Slow response");
        var second = await history.StartRunAsync(false, CancellationToken.None);
        history.AppendLog(second, "Error", "Second run error");

        var runs = await history.GetRunsAsync(CancellationToken.None);
        Assert.Equal(2, runs.Count);
        Assert.Equal(first, runs[0].Id);
        Assert.Equal(second, runs[1].Id);
        var logs = await history.GetLogsAsync(first, 0, CancellationToken.None);
        Assert.Equal(2, logs.Count);
        Assert.Equal("First message", logs[0].Message);
        Assert.Equal("Slow response", logs[1].Message);
        Assert.Equal("Information", logs[0].Level);
        Assert.Equal("Warning", logs[1].Level);
        Assert.Equal(first, logs[0].RunId);
        Assert.Equal(TimeSpan.Zero, logs[0].OccurredAtUtc.Offset);
        Assert.Equal(
            "Slow response",
            Assert
                .Single(
                    await history.GetLogsAsync(
                        first,
                        logs[0].Id,
                        CancellationToken.None
                    )
                )
                .Message
        );

        await history.DeleteRunAsync(first, CancellationToken.None);
        Assert.Equal(
            second,
            Assert.Single(await history.GetRunsAsync(CancellationToken.None)).Id
        );
        Assert.Empty(
            await history.GetLogsAsync(first, 0, CancellationToken.None)
        );
        Assert.Single(
            await history.GetLogsAsync(second, 0, CancellationToken.None)
        );
    }

    [Fact]
    public async Task StartRunAsync_Should_Purge_Expired_Runs_Only_When_A_New_Run_Starts()
    {
        var settings = CreateSqliteSettings();
        var history = new SqliteJobRunHistory(
            settings,
            new JobSettings("0 0 * * * *", 2, 7)
        );
        var oldId = await history.StartRunAsync(false, CancellationToken.None);
        history.AppendLog(oldId, "Information", "Old log");
        await using (
            var connection = new SqliteConnection(
                $"Data Source={settings.DatabasePath};Pooling=False"
            )
        )
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText =
                "UPDATE job_runs SET started_at_utc = $old WHERE id = $id;";
            command.Parameters.AddWithValue(
                "$old",
                DateTimeOffset.UtcNow.AddDays(-8).ToString("O")
            );
            command.Parameters.AddWithValue("$id", oldId);
            await command.ExecuteNonQueryAsync();
        }

        Assert.Equal(
            oldId,
            Assert.Single(await history.GetRunsAsync(CancellationToken.None)).Id
        );
        var newId = await history.StartRunAsync(false, CancellationToken.None);
        Assert.Equal(
            newId,
            Assert.Single(await history.GetRunsAsync(CancellationToken.None)).Id
        );
        Assert.Empty(
            await history.GetLogsAsync(oldId, 0, CancellationToken.None)
        );
    }
}
