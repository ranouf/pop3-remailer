namespace IMAPRemailer.Core.Email;

public interface IEmailManager
{
    /// <summary>Transfers a bounded batch of source emails to the destination.</summary>
    /// <param name="cancellationToken">Cancels the transfer run.</param>
    /// <param name="dryRun">Inspects emails without importing or finalizing them.</param>
    /// <returns>A task that completes when the batch finishes.</returns>
    Task TransferAsync(
        CancellationToken cancellationToken,
        bool dryRun = false
    );
}
