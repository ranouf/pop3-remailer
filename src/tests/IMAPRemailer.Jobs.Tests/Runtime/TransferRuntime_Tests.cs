using Cronos;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Jobs.Runtime;
using IMAPRemailer.Jobs.Tests.Fakes;
using IMAPRemailer.Jobs.Triggers;
using Microsoft.Extensions.Logging.Abstractions;

namespace IMAPRemailer.Jobs.Tests.Runtime;

public sealed class TransferRuntime_Tests
{
    [Fact]
    public async Task RunAsync_Should_Run_Once_And_Stop_On_Cancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var imap = new FakeEmailSource { OnRead = cancellation.Cancel };
        var runtime = CreateRuntime(imap);

        await runtime.RunAsync(cancellation.Token);

        Assert.Equal(1, imap.ReadCount);
    }

    [Fact]
    public async Task RunAsync_Should_Stop_After_Cancelled_Execution()
    {
        using var cancellation = new CancellationTokenSource();
        var imap = new FakeEmailSource
        {
            OnRead = () =>
            {
                cancellation.Cancel();
                throw new OperationCanceledException(cancellation.Token);
            },
        };

        await CreateRuntime(imap).RunAsync(cancellation.Token);

        Assert.Equal(1, imap.ReadCount);
    }

    [Fact]
    public async Task RunAsync_Should_Log_Failure_And_Stop_On_Cancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var imap = new FakeEmailSource
        {
            FailRead = true,
            OnRead = cancellation.Cancel,
        };

        await CreateRuntime(imap).RunAsync(cancellation.Token);

        Assert.Equal(1, imap.ReadCount);
    }

    [Fact]
    public async Task RunAsync_Should_Stop_When_Cancelled_While_Waiting()
    {
        using var cancellation = new CancellationTokenSource(
            TimeSpan.FromMilliseconds(50)
        );
        var imap = new FakeEmailSource();

        await CreateRuntime(imap).RunAsync(cancellation.Token);

        Assert.Equal(0, imap.ReadCount);
    }

    [Fact]
    public async Task RunAsync_Should_Run_Again_On_Next_Tick()
    {
        using var cancellation = new CancellationTokenSource(
            TimeSpan.FromSeconds(5)
        );
        var imap = new FakeEmailSource();
        imap.OnRead = () =>
        {
            if (imap.ReadCount == 2)
            {
                cancellation.Cancel();
            }
        };

        await CreateRuntime(imap).RunAsync(cancellation.Token);

        Assert.Equal(2, imap.ReadCount);
    }

    [Fact]
    public async Task RunAsync_Should_Stop_Without_Execution_When_Already_Cancelled()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var imap = new FakeEmailSource();

        await CreateRuntime(imap).RunAsync(cancellation.Token);

        Assert.Equal(0, imap.ReadCount);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(60)]
    public async Task RunAsync_Should_Wait_For_Saved_Interval(int minutes)
    {
        using var cancellation = new CancellationTokenSource(
            TimeSpan.FromMilliseconds(50)
        );
        var imap = new FakeEmailSource();
        var overridesStore = new FakeJobOverridesStore
        {
            Current = new JobOverrides(minutes, null),
        };

        await CreateRuntime(imap, overridesStore).RunAsync(cancellation.Token);

        Assert.Equal(0, imap.ReadCount);
    }

    #region Private

    private static TransferRuntime CreateRuntime(
        FakeEmailSource imap,
        FakeJobOverridesStore? overridesStore = null
    )
    {
        var service = new EmailManager(
            imap,
            new FakeEmailDestination(),
            new FakeTransferState(),
            new FakeJobRunHistory(),
            new RunLogContext(),
            NullLogger<EmailManager>.Instance
        );
        return new TransferRuntime(
            new CronTransferTrigger(service),
            NullLogger<TransferRuntime>.Instance,
            CronExpression.Parse("* * * * * *", CronFormat.IncludeSeconds),
            overridesStore ?? new FakeJobOverridesStore()
        );
    }

    #endregion
}
