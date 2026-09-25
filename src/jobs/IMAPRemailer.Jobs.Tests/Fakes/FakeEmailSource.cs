using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Jobs.Tests.Fakes;

public sealed class FakeEmailSource : IEmailSourceService
{
    public IReadOnlyList<SourceEmail> Messages { get; set; } = [];
    public bool FailRead { get; set; }
    public Action? OnRead { get; set; }
    public int ReadCount { get; private set; }
    public int DisconnectCount { get; private set; }
    public bool FailDisconnect { get; set; }
    public List<string> MovedMessages { get; } = [];
    public bool FailMove { get; set; }

    public Task CheckAsync(CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task<IReadOnlyList<SourceEmail>> ReadAsync(
        CancellationToken cancellationToken
    )
    {
        ReadCount++;
        OnRead?.Invoke();
        if (FailRead)
        {
            throw new InvalidOperationException("IMAP unavailable");
        }

        return Task.FromResult(Messages);
    }

    public Task MarkTransferredAsync(
        string sourceId,
        CancellationToken cancellationToken
    )
    {
        if (FailMove)
        {
            throw new InvalidOperationException("IMAP move failed");
        }

        MovedMessages.Add(sourceId);
        return Task.CompletedTask;
    }

    public Task DisconnectAsync(CancellationToken cancellationToken)
    {
        DisconnectCount++;
        if (FailDisconnect)
        {
            throw new InvalidOperationException("IMAP disconnect failed");
        }

        return Task.CompletedTask;
    }
}
