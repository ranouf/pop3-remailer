using IMAPRemailer.Core.Email;

namespace IMAPRemailer.Jobs.Tests.Fakes;

public sealed class FakeTransferState : ITransferState
{
    public HashSet<string> Imported { get; } = new(StringComparer.Ordinal);
    public bool FailMark { get; set; }

    public bool Contains(string sourceId) => Imported.Contains(sourceId);

    public Task MarkImportedAsync(
        string sourceId,
        CancellationToken cancellationToken
    )
    {
        if (FailMark)
        {
            throw new InvalidOperationException("State write failed");
        }

        Imported.Add(sourceId);
        return Task.CompletedTask;
    }
}
