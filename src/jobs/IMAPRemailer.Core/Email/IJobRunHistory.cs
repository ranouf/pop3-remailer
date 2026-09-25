using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Core.Email;

/// <summary>Persists job runs for status and recent history display.</summary>
public interface IJobRunHistory
{
    /// <summary>Creates a running record before reading source emails.</summary>
    /// <param name="dryRun">Whether the run will make no transfer changes.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <returns>The identifier of the created run.</returns>
    Task<long> StartRunAsync(bool dryRun, CancellationToken cancellationToken);

    /// <summary>Updates the counters displayed while a run is in progress.</summary>
    Task UpdateRunAsync(
        long runId,
        int sourceCount,
        int imported,
        int alreadyPresent,
        int pending,
        CancellationToken cancellationToken
    );

    /// <summary>Completes a running record with its result.</summary>
    /// <param name="runId">The identifier returned by StartRunAsync.</param>
    /// <param name="result">The final outcome and counts.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <returns>A task that completes after the result is stored.</returns>
    Task CompleteRunAsync(
        long runId,
        JobRunResult result,
        CancellationToken cancellationToken
    );

    /// <summary>Reads every retained run, oldest first.</summary>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <returns>All retained run records.</returns>
    Task<IReadOnlyList<JobRunSummary>> GetRunsAsync(
        CancellationToken cancellationToken
    );

    /// <summary>Reads a limited number of runs, newest first.</summary>
    /// <param name="count">The maximum number of runs to return.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <returns>The newest run records.</returns>
    Task<IReadOnlyList<JobRunSummary>> GetRecentRunsAsync(
        int count,
        CancellationToken cancellationToken
    );

    /// <summary>Reads the log entries of one run in write order.</summary>
    /// <param name="runId">The run identifier.</param>
    /// <param name="afterId">The last log identifier already read.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <returns>Log entries newer than the given identifier.</returns>
    Task<IReadOnlyList<JobRunLog>> GetLogsAsync(
        long runId,
        long afterId,
        CancellationToken cancellationToken
    );

    /// <summary>Deletes one run and its log entries.</summary>
    /// <param name="runId">The run identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <returns>A task that completes after deletion.</returns>
    Task DeleteRunAsync(long runId, CancellationToken cancellationToken);

    /// <summary>Appends one formatted log entry to a running job.</summary>
    /// <param name="runId">The run identifier.</param>
    /// <param name="level">The .NET log level.</param>
    /// <param name="message">The formatted message.</param>
    void AppendLog(long runId, string level, string message);
}
