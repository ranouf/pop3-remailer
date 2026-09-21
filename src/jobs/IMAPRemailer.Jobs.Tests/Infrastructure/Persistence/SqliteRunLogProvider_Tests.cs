using IMAPRemailer.Core.Email;
using IMAPRemailer.Infrastructure.Persistence;
using IMAPRemailer.Jobs.Tests.Fakes;
using Microsoft.Extensions.Logging;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Persistence;

public sealed class SqliteRunLogProvider_Tests
{
    [Fact]
    public void Logger_Should_Persist_Information_Warnings_And_Errors_Only_During_Run()
    {
        var history = new FakeJobRunHistory();
        var context = new RunLogContext();
        using var provider = new SqliteRunLogProvider(history, context);
        var logger = provider.CreateLogger("Test");

        logger.LogInformation("Outside run");
        Assert.False(logger.IsEnabled(LogLevel.Debug));
        Assert.True(logger.IsEnabled(LogLevel.Information));
        using (logger.BeginScope("test scope"))
        using (context.Begin(42))
        {
            logger.LogDebug("Hidden");
            logger.LogInformation("Started {Count}", 2);
            logger.LogWarning("Slow source");
            logger.LogError(
                new InvalidOperationException("Import failed"),
                "Transfer failed"
            );
        }

        Assert.Equal(3, history.Logged.Count);
        Assert.All(history.Logged, entry => Assert.Equal(42, entry.RunId));
        Assert.Equal((42L, "Information", "Started 2"), history.Logged[0]);
        Assert.Equal((42L, "Warning", "Slow source"), history.Logged[1]);
        Assert.Equal("Error", history.Logged[2].Level);
        Assert.Contains("Import failed", history.Logged[2].Message);
    }
}
