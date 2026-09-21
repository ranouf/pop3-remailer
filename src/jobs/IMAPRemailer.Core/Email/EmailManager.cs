using System.Diagnostics;
using IMAPRemailer.Core.Email.Helpers;
using IMAPRemailer.Core.Email.Models;
using Microsoft.Extensions.Logging;

namespace IMAPRemailer.Core.Email;

/// <summary>Coordinates the transfer of source emails to the destination.</summary>
/// <remarks>
/// Reads a batch, checks whether each email was previously transferred, imports new
/// emails, records confirmed imports, and archives confirmed emails at the source.
/// The services supply provider-specific behavior; this manager owns the order of
/// operations and logs their durations.
/// </remarks>
public sealed class EmailManager(
    IEmailSourceService source,
    IEmailDestinationService destination,
    ITransferState state,
    IJobRunHistory runs,
    RunLogContext runLogContext,
    ILogger<EmailManager> logger
) : IEmailManager
{
    /// <summary>Transfers the emails returned by the source for one job run.</summary>
    /// <param name="cancellationToken">Cancels source, destination, and state operations.</param>
    /// <param name="dryRun">
    /// When true, reports the actions that would be taken without importing,
    /// recording, or archiving any email.
    /// </param>
    /// <returns>A task that completes after every email in the batch is processed.</returns>
    /// <remarks>
    /// For each email, the manager first checks local transfer state, then the
    /// destination using its RFC 822 Message-ID when available. A confirmed email
    /// is archived at the source; a new email is imported before its confirmation
    /// is recorded and it is archived. Failures stop the run and are timed in the log.
    /// </remarks>
    public async Task TransferAsync(
        CancellationToken cancellationToken,
        bool dryRun = false
    )
    {
        var runClock = Stopwatch.StartNew();
        var status = "Failed";
        var sourceCount = 0;
        var imported = 0;
        var skipped = 0;
        var pending = 0;
        string? error = null;
        var runId = await runs.StartRunAsync(dryRun, cancellationToken);
        using var runLogScope = runLogContext.Begin(runId);
        logger.LogInformation("JOB_RUN_STARTED DryRun={DryRun}", dryRun);
        try
        {
            // Step 1: Read the source batch. The source service enforces the per-run limit.
            logger.LogInformation("Reading source emails.");
            var messages = await TransferMetricsHelper.MeasureAsync(
                logger,
                "SourceRead",
                () => source.ReadAsync(cancellationToken)
            );
            sourceCount = messages.Count;
            logger.LogInformation(
                "Source returned {MessageCount} emails for this run.",
                messages.Count
            );

            foreach (var message in messages)
            {
                var emailClock = Stopwatch.StartNew();
                var outcome = "Failed";
                try
                {
                    // Step 2: Resume an email already confirmed in local state.
                    // It only needs source archiving, even after a previous archive failure.
                    logger.LogInformation(
                        "Processing source email {MessageId}.",
                        message.Id
                    );
                    if (
                        TransferMetricsHelper.Measure(
                            logger,
                            "StateLookup",
                            () => state.Contains(message.Id)
                        )
                    )
                    {
                        logger.LogInformation(
                            "Email {MessageId} was already imported into the destination.",
                            message.Id
                        );
                        if (!dryRun)
                        {
                            await ArchiveAsync(message.Id, cancellationToken);
                        }

                        outcome = "AlreadyPresent";
                        skipped++;
                        continue;
                    }

                    // Step 3: Check the destination before importing when the email has
                    // a Message-ID. This also handles imports whose state write failed.
                    if (
                        !string.IsNullOrWhiteSpace(message.MessageId)
                        && await TransferMetricsHelper.MeasureAsync(
                            logger,
                            "DestinationLookup",
                            () =>
                                destination.ExistsAsync(
                                    message.MessageId,
                                    cancellationToken
                                )
                        )
                    )
                    {
                        logger.LogInformation(
                            "Email {MessageId} already exists at the destination.",
                            message.Id
                        );
                        if (!dryRun)
                        {
                            await StoreAndArchiveAsync(
                                message.Id,
                                cancellationToken
                            );
                        }

                        outcome = "AlreadyPresent";
                        skipped++;
                        continue;
                    }

                    // Step 4: A dry run reports pending work without changing either mailbox or SQLite.
                    if (dryRun)
                    {
                        logger.LogInformation(
                            "Email {MessageId} would be imported.",
                            message.Id
                        );
                        outcome = "Pending";
                        pending++;
                        continue;
                    }

                    // Step 5: Import the original email. A failed import leaves it unconfirmed.
                    logger.LogInformation(
                        "Importing email {MessageId} into the destination.",
                        message.Id
                    );
                    await TransferMetricsHelper.MeasureAsync(
                        logger,
                        "DestinationImport",
                        () =>
                            destination.ImportAsync(
                                message.Raw,
                                cancellationToken
                            )
                    );
                    // Step 6: Record the successful import, then archive it at the source.
                    await StoreAndArchiveAsync(message.Id, cancellationToken);
                    outcome = "Imported";
                    imported++;
                }
                finally
                {
                    // Record per-email time even when one of its operations fails.
                    logger.LogInformation(
                        "TIMING EmailId={EmailId} Outcome={Outcome} DurationMs={DurationMs}",
                        message.Id,
                        outcome,
                        emailClock.Elapsed.TotalMilliseconds
                    );
                }
            }

            logger.LogInformation(
                "Synchronization completed: {Imported} imported, {Skipped} already present, {Pending} pending.",
                imported,
                skipped,
                pending
            );
            logger.LogInformation("JOB_RUN_COMPLETED");
            status = "Completed";
        }
        catch (Exception exception)
        {
            error = exception.Message;
            logger.LogError(
                exception,
                "Synchronization failed: {Error}",
                error
            );
            throw;
        }
        finally
        {
            try
            {
                // Persist totals for the tray even when the transfer fails.
                await runs.CompleteRunAsync(
                    runId,
                    new JobRunResult(
                        status == "Completed",
                        sourceCount,
                        imported,
                        skipped,
                        pending,
                        runClock.Elapsed,
                        error
                    ),
                    CancellationToken.None
                );
            }
            finally
            {
                // Record total run time and failure status even if reading or processing fails.
                logger.LogInformation(
                    "TIMING RunStatus={RunStatus} TotalDurationMs={TotalDurationMs}",
                    status,
                    runClock.Elapsed.TotalMilliseconds
                );
            }
        }
    }

    #region Private

    /// <summary>Stores confirmation before archiving a message at its source.</summary>
    /// <param name="sourceId">The source-specific identifier.</param>
    /// <param name="cancellationToken">Cancels the operations.</param>
    /// <returns>A task that completes after both operations.</returns>
    /// <remarks>
    /// Recording the import first lets a later run retry archiving without importing
    /// the same email again if the source operation fails.
    /// </remarks>
    private async Task StoreAndArchiveAsync(
        string sourceId,
        CancellationToken cancellationToken
    )
    {
        await TransferMetricsHelper.MeasureAsync(
            logger,
            "StateWrite",
            () => state.MarkImportedAsync(sourceId, cancellationToken)
        );
        logger.LogInformation(
            "Stored destination email {MessageId} in SQLite.",
            sourceId
        );
        await ArchiveAsync(sourceId, cancellationToken);
    }

    /// <summary>Finalizes an imported message at its source.</summary>
    /// <param name="sourceId">The source-specific identifier.</param>
    /// <param name="cancellationToken">Cancels the operation.</param>
    /// <returns>A task that completes when the source confirms the update.</returns>
    private async Task ArchiveAsync(
        string sourceId,
        CancellationToken cancellationToken
    )
    {
        await TransferMetricsHelper.MeasureAsync(
            logger,
            "SourceArchive",
            () => source.MarkTransferredAsync(sourceId, cancellationToken)
        );
        logger.LogInformation(
            "Finalized email {MessageId} at the source.",
            sourceId
        );
    }

    #endregion
}
