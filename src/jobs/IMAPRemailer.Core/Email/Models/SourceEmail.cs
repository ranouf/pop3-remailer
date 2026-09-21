namespace IMAPRemailer.Core.Email.Models;

/// <summary>An email with an opaque identifier assigned by its source.</summary>
/// <param name="Id">The source-specific message identifier.</param>
/// <param name="MessageId">The RFC 822 message ID, when present.</param>
/// <param name="Raw">The complete RFC 822 message.</param>
public sealed record SourceEmail(string Id, string? MessageId, byte[] Raw);
