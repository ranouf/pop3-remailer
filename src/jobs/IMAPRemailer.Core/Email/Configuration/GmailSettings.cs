namespace IMAPRemailer.Core.Email.Configuration;

public sealed record GmailSettings(
    string ClientId,
    string ClientSecret,
    string RefreshToken,
    string UserEmail
);
