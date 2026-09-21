using IMAPRemailer.Core.Email;

namespace IMAPRemailer.Jobs.Tests.Fakes;

public sealed class FakeEmailDestination : IEmailDestinationService
{
    public bool MessageExists { get; set; }
    public bool FailImport { get; set; }
    public int CheckCount { get; private set; }
    public int LookupCount { get; private set; }
    public List<byte[]> ImportedMessages { get; } = [];

    public Task CheckAsync(CancellationToken cancellationToken)
    {
        CheckCount++;
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(
        string messageId,
        CancellationToken cancellationToken
    )
    {
        LookupCount++;
        return Task.FromResult(MessageExists);
    }

    public Task ImportAsync(
        byte[] rawMessage,
        CancellationToken cancellationToken
    )
    {
        if (FailImport)
        {
            throw new InvalidOperationException("Import failed");
        }

        ImportedMessages.Add(rawMessage);
        return Task.CompletedTask;
    }
}
