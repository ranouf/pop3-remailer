using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Jobs.Tests.Fakes;

public sealed class FakeJobRunHistory : IJobRunHistory
{
    public List<JobRunResult> Completed { get; } = [];
    public List<(
        int SourceCount,
        int Imported,
        int AlreadyPresent,
        int Pending
    )> Updates { get; } = [];
    public List<(long RunId, string Level, string Message)> Logged { get; } =
    [];

    public Task<long> StartRunAsync(
        bool dryRun,
        CancellationToken cancellationToken
    ) => Task.FromResult(1L);

    public Task UpdateRunAsync(
        long runId,
        int sourceCount,
        int imported,
        int alreadyPresent,
        int pending,
        CancellationToken cancellationToken
    )
    {
        Updates.Add((sourceCount, imported, alreadyPresent, pending));
        return Task.CompletedTask;
    }

    public Task CompleteRunAsync(
        long runId,
        JobRunResult result,
        CancellationToken cancellationToken
    )
    {
        Completed.Add(result);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<JobRunSummary>> GetRecentRunsAsync(
        int count,
        CancellationToken cancellationToken
    ) => Task.FromResult<IReadOnlyList<JobRunSummary>>([]);

    public Task<IReadOnlyList<JobRunSummary>> GetRunsAsync(
        CancellationToken cancellationToken
    ) => Task.FromResult<IReadOnlyList<JobRunSummary>>([]);

    public Task<IReadOnlyList<JobRunLog>> GetLogsAsync(
        long runId,
        long afterId,
        CancellationToken cancellationToken
    ) => Task.FromResult<IReadOnlyList<JobRunLog>>([]);

    public Task DeleteRunAsync(
        long runId,
        CancellationToken cancellationToken
    ) => Task.CompletedTask;

    public void AppendLog(long runId, string level, string message) =>
        Logged.Add((runId, level, message));
}
