using System.Text.Json;
using IMAPRemailer.Infrastructure.Persistence;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Persistence;

public sealed class SqliteTransferState_Tests : BaseTest
{
    private static readonly string[] LegacyMessageIds = ["one", "two"];

    [Fact]
    public async Task MarkImportedAsync_Should_Persist_MessageId_Across_Instances()
    {
        var settings = CreateSqliteSettings();
        using (var state = new SqliteTransferState(settings))
        {
            Assert.False(state.Contains("messageId-1"));
            await state.MarkImportedAsync(
                "messageId-1",
                CancellationToken.None
            );
            await state.MarkImportedAsync(
                "messageId-1",
                CancellationToken.None
            );
            Assert.True(state.Contains("messageId-1"));
            Assert.False(state.Contains("UIDL-1"));
        }

        using var reopened = new SqliteTransferState(settings);
        Assert.True(reopened.Contains("messageId-1"));
    }

    [Fact]
    public void Constructor_Should_Migrate_Legacy_Json_Once()
    {
        var settings = CreateSqliteSettings();
        Directory.CreateDirectory(TestDirectory);
        var legacyPath = Path.ChangeExtension(settings.DatabasePath, ".json");
        File.WriteAllText(
            legacyPath,
            JsonSerializer.Serialize(LegacyMessageIds)
        );

        using (var state = new SqliteTransferState(settings))
        {
            Assert.True(state.Contains("one"));
            Assert.True(state.Contains("two"));
            Assert.False(File.Exists(legacyPath));
            Assert.True(File.Exists(legacyPath + ".migrated"));
        }

        using var reopened = new SqliteTransferState(settings);
        Assert.True(reopened.Contains("one"));
    }
}
