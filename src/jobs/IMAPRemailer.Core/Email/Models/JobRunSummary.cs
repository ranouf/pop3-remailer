namespace IMAPRemailer.Core.Email.Models;

/// <summary>A persisted synchronization run shown in the tray history.</summary>
/// <param name="Id">The local run identifier.</param>
/// <param name="StartedAtUtc">When the run started, in UTC.</param>
/// <param name="CompletedAtUtc">When it finished, or null while it is running.</param>
/// <param name="DryRun">Whether the run made no transfer changes.</param>
/// <param name="Status">Running, Completed, or Failed.</param>
/// <param name="SourceCount">The number of emails read from the source.</param>
/// <param name="Imported">The number of imported emails.</param>
/// <param name="AlreadyPresent">The number of emails already present.</param>
/// <param name="Pending">The number of emails pending in a dry run.</param>
/// <param name="DurationMs">Total execution time in milliseconds, when finished.</param>
/// <param name="Error">The failure message, when available.</param>
public sealed record JobRunSummary(
    long Id,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    bool DryRun,
    string Status,
    int SourceCount,
    int Imported,
    int AlreadyPresent,
    int Pending,
    double? DurationMs,
    string? Error
);
