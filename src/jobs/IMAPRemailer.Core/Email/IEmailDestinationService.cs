namespace IMAPRemailer.Core.Email;

public interface IEmailDestinationService
{
    /// <summary>Verifies access to the destination mailbox.</summary>
    /// <param name="cancellationToken">Cancels the connection attempt.</param>
    /// <returns>A task that completes after the connection is verified.</returns>
    Task CheckAsync(CancellationToken cancellationToken);

    /// <summary>Checks whether the destination contains an RFC 822 message ID.</summary>
    /// <param name="messageId">The RFC 822 message ID to find.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>Whether the destination already contains the message.</returns>
    Task<bool> ExistsAsync(
        string messageId,
        CancellationToken cancellationToken
    );

    /// <summary>Imports a complete MIME message into the destination.</summary>
    /// <param name="rawMessage">The complete MIME message bytes.</param>
    /// <param name="cancellationToken">Cancels the import.</param>
    /// <returns>A task that completes when the destination accepts the message.</returns>
    Task ImportAsync(byte[] rawMessage, CancellationToken cancellationToken);
}
