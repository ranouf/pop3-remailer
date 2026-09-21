using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace IMAPRemailer.Core.Email.Helpers;

/// <summary>Measures transfer operations and writes their duration to the log.</summary>
internal static class TransferMetricsHelper
{
    /// <summary>Measures a synchronous operation, including failures.</summary>
    /// <typeparam name="T">The operation result type.</typeparam>
    /// <param name="logger">The logger receiving the duration.</param>
    /// <param name="stage">The transfer stage.</param>
    /// <param name="operation">The operation to measure.</param>
    /// <returns>The operation result.</returns>
    public static T Measure<T>(ILogger logger, string stage, Func<T> operation)
    {
        var clock = Stopwatch.StartNew();
        try
        {
            return operation();
        }
        finally
        {
            LogDuration(logger, stage, clock.Elapsed);
        }
    }

    /// <summary>Measures an asynchronous operation with a result, including failures.</summary>
    /// <typeparam name="T">The operation result type.</typeparam>
    /// <param name="logger">The logger receiving the duration.</param>
    /// <param name="stage">The transfer stage.</param>
    /// <param name="operation">The operation to measure.</param>
    /// <returns>The operation result.</returns>
    public static async Task<T> MeasureAsync<T>(
        ILogger logger,
        string stage,
        Func<Task<T>> operation
    )
    {
        var clock = Stopwatch.StartNew();
        try
        {
            return await operation();
        }
        finally
        {
            LogDuration(logger, stage, clock.Elapsed);
        }
    }

    /// <summary>Measures an asynchronous operation, including failures.</summary>
    /// <param name="logger">The logger receiving the duration.</param>
    /// <param name="stage">The transfer stage.</param>
    /// <param name="operation">The operation to measure.</param>
    /// <returns>A task that completes with the operation.</returns>
    public static async Task MeasureAsync(
        ILogger logger,
        string stage,
        Func<Task> operation
    )
    {
        var clock = Stopwatch.StartNew();
        try
        {
            await operation();
        }
        finally
        {
            LogDuration(logger, stage, clock.Elapsed);
        }
    }

    #region Private

    /// <summary>Writes the elapsed time of a transfer operation to the job log.</summary>
    /// <param name="logger">The logger receiving the duration.</param>
    /// <param name="stage">The transfer stage.</param>
    /// <param name="duration">The elapsed time.</param>
    private static void LogDuration(
        ILogger logger,
        string stage,
        TimeSpan duration
    ) =>
        logger.LogInformation(
            "TIMING Stage={Stage} DurationMs={DurationMs}",
            stage,
            duration.TotalMilliseconds
        );

    #endregion
}
