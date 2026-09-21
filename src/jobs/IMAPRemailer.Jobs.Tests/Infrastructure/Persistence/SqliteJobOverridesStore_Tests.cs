using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Infrastructure.Persistence;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Persistence;

public sealed class SqliteJobOverridesStore_Tests : BaseTest
{
    [Fact]
    public async Task Choices_Should_Persist_And_Allow_Return_To_Defaults()
    {
        var settings = CreateSqliteSettings();
        var store = new SqliteJobOverridesStore(settings);
        Assert.Equal(
            new JobOverrides(null, null),
            await store.GetAsync(CancellationToken.None)
        );

        await store.SaveAsync(new JobOverrides(15, 50), CancellationToken.None);
        Assert.Equal(
            new JobOverrides(15, 50),
            await new SqliteJobOverridesStore(settings).GetAsync(
                CancellationToken.None
            )
        );

        await store.SaveAsync(
            new JobOverrides(null, null),
            CancellationToken.None
        );
        Assert.Equal(
            new JobOverrides(null, null),
            await store.GetAsync(CancellationToken.None)
        );
    }
}
