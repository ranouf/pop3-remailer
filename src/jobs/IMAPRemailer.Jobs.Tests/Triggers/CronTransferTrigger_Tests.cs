using IMAPRemailer.Core.Email;
using IMAPRemailer.Jobs.Tests.Fakes;
using IMAPRemailer.Jobs.Triggers;
using Microsoft.Extensions.Logging.Abstractions;

namespace IMAPRemailer.Jobs.Tests.Triggers;

public sealed class CronTransferTrigger_Tests
{
    [Fact]
    public async Task ExecuteAsync_Should_Forward_Execution()
    {
        var gmail = new FakeEmailDestination();
        var imap = new FakeEmailSource();
        var service = new EmailManager(
            imap,
            gmail,
            new FakeTransferState(),
            new FakeJobRunHistory(),
            new RunLogContext(),
            NullLogger<EmailManager>.Instance
        );

        await new CronTransferTrigger(service).ExecuteAsync(
            CancellationToken.None
        );

        Assert.Equal(0, gmail.CheckCount);
        Assert.Equal(1, imap.ReadCount);
    }
}
