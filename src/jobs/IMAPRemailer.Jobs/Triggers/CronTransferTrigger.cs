using IMAPRemailer.Core.Email;

namespace IMAPRemailer.Jobs.Triggers;

public sealed class CronTransferTrigger(IEmailManager manager)
{
    /// <summary>Starts one transfer run when called by the cron runtime or a manual command.</summary>
    /// <param name="cancellationToken">Cancels the transfer run.</param>
    /// <param name="dryRun">Checks pending messages without importing them or updating state.</param>
    /// <returns>A task that completes when the transfer run finishes.</returns>
    public Task ExecuteAsync(
        CancellationToken cancellationToken,
        bool dryRun = false
    ) => manager.TransferAsync(cancellationToken, dryRun);
}
