namespace IMAPRemailer.Core.Email.Models;

/// <summary>One persisted log entry belonging to a synchronization run.</summary>
/// <param name="Id">The ordered log identifier.</param>
/// <param name="RunId">The synchronization run identifier.</param>
/// <param name="OccurredAtUtc">When the entry was written.</param>
/// <param name="Level">The .NET log level.</param>
/// <param name="Message">The formatted log message.</param>
public sealed record JobRunLog(
    long Id,
    long RunId,
    DateTimeOffset OccurredAtUtc,
    string Level,
    string Message
);
