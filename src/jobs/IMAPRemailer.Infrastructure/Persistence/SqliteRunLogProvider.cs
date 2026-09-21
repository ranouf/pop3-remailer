using IMAPRemailer.Core.Email;
using Microsoft.Extensions.Logging;

namespace IMAPRemailer.Infrastructure.Persistence;

/// <summary>Copies run-scoped .NET logs to SQLite for the tray history.</summary>
public sealed class SqliteRunLogProvider(
    IJobRunHistory history,
    RunLogContext context
) : ILoggerProvider
{
    /// <inheritdoc />
    public ILogger CreateLogger(string categoryName) =>
        new RunLogger(history, context);

    /// <inheritdoc />
    public void Dispose() { }

    #region Private

    private sealed class RunLogger(
        IJobRunHistory history,
        RunLogContext context
    ) : ILogger
    {
        /// <inheritdoc />
        public IDisposable BeginScope<TState>(TState state)
            where TState : notnull => NoopScope.Instance;

        /// <inheritdoc />
        public bool IsEnabled(LogLevel logLevel) =>
            logLevel >= LogLevel.Information;

        /// <inheritdoc />
        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter
        )
        {
            if (!IsEnabled(logLevel) || context.CurrentRunId is not long runId)
            {
                return;
            }

            var message = formatter(state, exception);
            if (exception is not null)
            {
                message += Environment.NewLine;
                message += exception.ToString();
            }

            history.AppendLog(runId, logLevel.ToString(), message);
        }
    }

    private sealed class NoopScope : IDisposable
    {
        public static readonly NoopScope Instance = new();

        /// <inheritdoc />
        public void Dispose() { }
    }

    #endregion
}
