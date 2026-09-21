namespace IMAPRemailer.Core.Email;

/// <summary>Associates logs on the current asynchronous flow with one run.</summary>
public sealed class RunLogContext
{
    private readonly AsyncLocal<long?> currentRunId = new();

    /// <summary>Gets the run receiving logs on this asynchronous flow.</summary>
    public long? CurrentRunId => currentRunId.Value;

    /// <summary>Associates subsequent logs with a run until the scope is disposed.</summary>
    /// <param name="runId">The run identifier.</param>
    /// <returns>A scope restoring the previous run identifier.</returns>
    public IDisposable Begin(long runId)
    {
        var previous = currentRunId.Value;
        currentRunId.Value = runId;
        return new Scope(this, previous);
    }

    #region Private

    private sealed class Scope(RunLogContext context, long? previous)
        : IDisposable
    {
        /// <summary>Restores the run that was active before this scope.</summary>
        public void Dispose() => context.currentRunId.Value = previous;
    }

    #endregion
}
