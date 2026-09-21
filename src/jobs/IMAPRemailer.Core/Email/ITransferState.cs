namespace IMAPRemailer.Core.Email;

public interface ITransferState
{
    /// <summary>Checks whether a source message has been confirmed at the destination.</summary>
    /// <param name="sourceId">The source-specific message identifier.</param>
    /// <returns>Whether the message is present in local state.</returns>
    bool Contains(string sourceId);

    /// <summary>Records a source message after the destination confirms it is present.</summary>
    /// <param name="sourceId">The source-specific message identifier.</param>
    /// <param name="cancellationToken">Cancels the database write.</param>
    /// <returns>A task that completes when the identifier is stored.</returns>
    Task MarkImportedAsync(
        string sourceId,
        CancellationToken cancellationToken
    );
}
