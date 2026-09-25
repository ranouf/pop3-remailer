using System.Text;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Models;
using IMAPRemailer.Jobs.Tests.Fakes;

namespace IMAPRemailer.Jobs.Tests.Email;

public sealed class EmailManager_Tests
{
    private readonly FakeEmailSource source = new();
    private readonly FakeEmailDestination destination = new();
    private readonly FakeTransferState state = new();
    private readonly FakeJobRunHistory runs = new();
    private readonly RunLogContext runLogContext = new();
    private readonly ListLogger<EmailManager> logger = new();

    [Fact]
    public async Task RunAsync_Should_Read_Mailbox_Without_Destination_Preflight()
    {
        await CreateManager().TransferAsync(CancellationToken.None);

        Assert.Equal(0, destination.CheckCount);
        Assert.Equal(1, source.ReadCount);
        Assert.Equal(1, source.DisconnectCount);
        Assert.Empty(source.MovedMessages);
        var run = Assert.Single(runs.Completed);
        Assert.True(run.Succeeded);
        Assert.Equal(0, run.SourceCount);
        Assert.Contains(
            logger.Messages,
            message => message.Contains("Source returned 0 emails")
        );
        Assert.Contains(
            logger.Messages,
            message => message.Contains("TIMING Stage=SourceRead DurationMs=")
        );
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("TIMING RunStatus=Completed TotalDurationMs=")
        );
    }

    [Fact]
    public async Task RunAsync_Should_Skip_Known_MessageId()
    {
        state.Imported.Add("source-1");
        source.Messages = [CreateMessage(1)];

        await CreateManager().TransferAsync(CancellationToken.None);

        Assert.Empty(destination.ImportedMessages);
        Assert.Equal(0, destination.LookupCount);
        Assert.Single(source.MovedMessages);
        Assert.Equal(1, Assert.Single(runs.Completed).AlreadyPresent);
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains(
                    "EmailId=source-1 Outcome=AlreadyPresent DurationMs="
                )
        );
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RunAsync_Should_Not_Import_Message_Already_In_Gmail(
        bool dryRun
    )
    {
        source.Messages = [CreateMessage(2)];
        destination.MessageExists = true;

        await CreateManager().TransferAsync(CancellationToken.None, dryRun);

        Assert.Equal(1, destination.LookupCount);
        Assert.Empty(destination.ImportedMessages);
        Assert.Equal(!dryRun, state.Contains("source-2"));
        Assert.Equal(!dryRun, source.MovedMessages.Count == 1);
    }

    [Fact]
    public async Task RunAsync_Should_Report_Pending_Without_Writing_In_Dry_Run()
    {
        source.Messages = [CreateMessage(3)];

        await CreateManager()
            .TransferAsync(CancellationToken.None, dryRun: true);

        Assert.Empty(destination.ImportedMessages);
        Assert.False(state.Contains("source-3"));
        Assert.Empty(source.MovedMessages);
        Assert.Equal(1, Assert.Single(runs.Completed).Pending);
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("EmailId=source-3 Outcome=Pending DurationMs=")
        );
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    public async Task RunAsync_Should_Import_And_Mark_New_Message(
        bool withMessageId,
        int expectedLookups
    )
    {
        var message = CreateMessage(4, withMessageId);
        source.Messages = [message];

        await CreateManager().TransferAsync(CancellationToken.None);

        Assert.Equal(expectedLookups, destination.LookupCount);
        Assert.Same(message.Raw, Assert.Single(destination.ImportedMessages));
        Assert.True(state.Contains("source-4"));
        Assert.Single(source.MovedMessages);
        var run = Assert.Single(runs.Completed);
        Assert.Equal(1, run.Imported);
        Assert.Equal(1, run.SourceCount);
        Assert.Equal((1, 0, 0, 0), runs.Updates[0]);
        Assert.Equal((1, 1, 0, 0), runs.Updates[^1]);
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains(
                    "EmailId=source-4 Outcome=Imported DurationMs="
                )
        );
        foreach (
            var stage in new[]
            {
                "SourceRead",
                "StateLookup",
                "DestinationImport",
                "StateWrite",
                "SourceArchive",
            }
        )
        {
            Assert.Contains(
                logger.Messages,
                message => message.Contains($"TIMING Stage={stage} DurationMs=")
            );
        }
    }

    [Fact]
    public async Task RunAsync_Should_Stop_When_Source_Read_Fails()
    {
        source.FailRead = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateManager().TransferAsync(CancellationToken.None)
        );

        Assert.Equal(1, source.ReadCount);
        Assert.Equal(1, source.DisconnectCount);
        Assert.Empty(destination.ImportedMessages);
        Assert.False(Assert.Single(runs.Completed).Succeeded);
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("TIMING RunStatus=Failed TotalDurationMs=")
        );
        Assert.Contains(
            logger.Messages,
            message => message.Contains("TIMING Stage=SourceRead DurationMs=")
        );
    }

    [Fact]
    public async Task RunAsync_Should_Record_Run_When_Disconnect_Fails()
    {
        source.FailDisconnect = true;

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () =>
                CreateManager().TransferAsync(CancellationToken.None)
        );

        Assert.Equal("IMAP disconnect failed", exception.Message);
        Assert.True(Assert.Single(runs.Completed).Succeeded);
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("TIMING RunStatus=Completed TotalDurationMs=")
        );
    }

    [Fact]
    public async Task RunAsync_Should_Leave_MessageId_Unmarked_When_Import_Fails()
    {
        source.Messages = [CreateMessage(5)];
        destination.FailImport = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateManager().TransferAsync(CancellationToken.None)
        );

        Assert.False(state.Contains("source-5"));
        Assert.Empty(source.MovedMessages);
        Assert.Equal("Import failed", Assert.Single(runs.Completed).Error);
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("TIMING RunStatus=Failed TotalDurationMs=")
        );
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("TIMING Stage=DestinationImport DurationMs=")
        );
        Assert.Contains(
            logger.Messages,
            message =>
                message.Contains("EmailId=source-5 Outcome=Failed DurationMs=")
        );
    }

    [Fact]
    public async Task RunAsync_Should_Retry_Registration_After_State_Write_Fails()
    {
        source.Messages = [CreateMessage(6)];
        state.FailMark = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateManager().TransferAsync(CancellationToken.None)
        );

        Assert.Single(destination.ImportedMessages);
        Assert.False(state.Contains("source-6"));
        Assert.Empty(source.MovedMessages);
    }

    [Fact]
    public async Task RunAsync_Should_Resume_Move_Without_Importing_Again()
    {
        source.Messages = [CreateMessage(7)];
        source.FailMove = true;
        var service = CreateManager();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.TransferAsync(CancellationToken.None)
        );

        Assert.True(state.Contains("source-7"));
        Assert.Single(destination.ImportedMessages);
        source.FailMove = false;

        await service.TransferAsync(CancellationToken.None);

        Assert.Single(destination.ImportedMessages);
        Assert.Single(source.MovedMessages);
    }

    #region Private

    private EmailManager CreateManager() =>
        new(source, destination, state, runs, runLogContext, logger);

    private static SourceEmail CreateMessage(
        uint uid,
        bool withMessageId = true
    )
    {
        var header = withMessageId
            ? "Message-ID: <message@example.com>\r\n"
            : "";
        var raw =
            $"From: source@example.com\r\nTo: target@example.com\r\n{header}Subject: Test\r\n\r\nBody";
        return new SourceEmail(
            $"source-{uid}",
            withMessageId ? "message@example.com" : null,
            Encoding.UTF8.GetBytes(raw)
        );
    }

    #endregion
}
