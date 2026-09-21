namespace IMAPRemailer.Core.Email.Configuration;

/// <summary>User choices that replace the matching appsettings values.</summary>
public sealed record JobOverrides(int? IntervalMinutes, int? MaxMessagesPerRun);
