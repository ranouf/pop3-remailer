namespace IMAPRemailer.Core.Email.Configuration;

public sealed record OrangeSettings(
    string Host,
    int Port,
    string Username,
    string Password,
    int TimeoutMs,
    string TransferredFolder
);
