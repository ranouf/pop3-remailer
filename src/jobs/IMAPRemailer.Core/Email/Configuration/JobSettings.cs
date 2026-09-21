namespace IMAPRemailer.Core.Email.Configuration;

/// <summary>Controls scheduling, batch size, and retained run history.</summary>
public sealed record JobSettings(
    string Cron,
    int MaxMessagesPerRun,
    int RunRetentionDays = 7
);
