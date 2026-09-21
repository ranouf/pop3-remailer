using Cronos;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Jobs.Triggers;
using Microsoft.Extensions.Logging;

namespace IMAPRemailer.Jobs.Runtime;

public sealed class TransferRuntime(
    CronTransferTrigger trigger,
    ILogger<TransferRuntime> logger,
    CronExpression defaultSchedule,
    IJobOverridesStore overridesStore
)
{
    /// <summary>Waits for each local-time cron occurrence and runs the transfer.</summary>
    /// <param name="cancellationToken">Stops the background scheduler.</param>
    /// <returns>A task that completes when scheduling stops.</returns>
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        int? scheduledInterval = null;
        DateTimeOffset? next = null;
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var overrides = await overridesStore.GetAsync(
                    cancellationToken
                );
                if (
                    next is null
                    || scheduledInterval != overrides.IntervalMinutes
                )
                {
                    scheduledInterval = overrides.IntervalMinutes;
                    var schedule = scheduledInterval is int minutes
                        ? CronExpression.Parse(
                            minutes == 60
                                ? "0 0 * * * *"
                                : $"0 */{minutes} * * * *",
                            CronFormat.IncludeSeconds
                        )
                        : defaultSchedule;
                    next = schedule
                        .GetNextOccurrence(
                            DateTimeOffset.UtcNow,
                            TimeZoneInfo.Local
                        )!
                        .Value;
                    logger.LogInformation(
                        "Next synchronization scheduled for {NextOccurrence}.",
                        next.Value.LocalDateTime
                    );
                }

                var remaining = next.Value - DateTimeOffset.UtcNow;
                if (remaining > TimeSpan.Zero)
                {
                    await Task.Delay(
                        remaining < TimeSpan.FromSeconds(5)
                            ? remaining
                            : TimeSpan.FromSeconds(5),
                        cancellationToken
                    );
                    continue;
                }

                next = null;
                await trigger.ExecuteAsync(cancellationToken);
            }
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                next = null;
                logger.LogInformation("JOB_RUN_FAILED");
                logger.LogError(
                    exception,
                    "Synchronization failed; retrying at the next cron occurrence."
                );
            }
        }
    }
}
