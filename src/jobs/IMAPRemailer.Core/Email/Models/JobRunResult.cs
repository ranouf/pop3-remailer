namespace IMAPRemailer.Core.Email.Models;

/// <summary>The outcome and totals of one synchronization run.</summary>
/// <param name="Succeeded">Whether every email completed successfully.</param>
/// <param name="SourceCount">The number of emails read from the source.</param>
/// <param name="Imported">The number of emails imported into the destination.</param>
/// <param name="AlreadyPresent">The number of emails already present at the destination.</param>
/// <param name="Pending">The number of emails left pending during a dry run.</param>
/// <param name="Duration">The total execution time.</param>
/// <param name="Error">The error message when the run failed.</param>
public sealed record JobRunResult(
    bool Succeeded,
    int SourceCount,
    int Imported,
    int AlreadyPresent,
    int Pending,
    TimeSpan Duration,
    string? Error
);
