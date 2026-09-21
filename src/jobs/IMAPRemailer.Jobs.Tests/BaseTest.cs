using IMAPRemailer.Core.Email.Configuration;

namespace IMAPRemailer.Jobs.Tests;

public abstract class BaseTest : IDisposable
{
    protected string TestDirectory { get; } =
        Path.Combine(
            Environment.CurrentDirectory,
            ".codex",
            "tests",
            Guid.NewGuid().ToString("N")
        );

    protected static OrangeSettings CreateOrangeSettings() =>
        new(
            "127.0.0.1",
            993,
            "orange@example.com",
            "password",
            3000,
            "Transferred to Gmail"
        );

    protected static GmailSettings CreateGmailSettings() =>
        new("client-id", "client-secret", "refresh-token", "gmail@example.com");

    protected static JobSettings CreateJobSettings() => new("0 0 * * * *", 2);

    protected SqliteSettings CreateSqliteSettings(
        string? databasePath = null
    ) => new(databasePath ?? Path.Combine(TestDirectory, "state.db"));

    public void Dispose()
    {
        if (Directory.Exists(TestDirectory))
        {
            Directory.Delete(TestDirectory, recursive: true);
        }

        GC.SuppressFinalize(this);
    }
}
