using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Core.Email;

public interface IEmailSourceService
{
    /// <summary>Verifies access to the source mailbox.</summary>
    /// <param name="cancellationToken">Cancels the connection attempt.</param>
    /// <returns>A task that completes after the connection is verified.</returns>
    Task CheckAsync(CancellationToken cancellationToken);

    /// <summary>Reads the newest messages available for transfer.</summary>
    /// <param name="cancellationToken">Cancels the mailbox read.</param>
    /// <returns>Messages up to the configured per-run limit.</returns>
    Task<IReadOnlyList<SourceEmail>> ReadAsync(
        CancellationToken cancellationToken
    );

    /// <summary>Finalizes a source message after the destination confirms it.</summary>
    /// <param name="sourceId">The source-specific message identifier.</param>
    /// <param name="cancellationToken">Cancels the source update.</param>
    /// <returns>A task that completes when the source confirms the update.</returns>
    Task MarkTransferredAsync(
        string sourceId,
        CancellationToken cancellationToken
    );

    /// <summary>Closes the source connection at the end of a transfer run.</summary>
    /// <param name="cancellationToken">Cancels the disconnection.</param>
    /// <returns>A task that completes when the connection is closed.</returns>
    Task DisconnectAsync(CancellationToken cancellationToken);
}
