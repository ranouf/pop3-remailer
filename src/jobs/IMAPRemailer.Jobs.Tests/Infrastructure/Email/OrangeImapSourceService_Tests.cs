using IMAPRemailer.Infrastructure.Email;
using IMAPRemailer.Jobs.Tests.Fakes;
using MailKit.Net.Imap;
using MimeKit;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Email;

public sealed class OrangeImapSourceService_Tests : BaseTest
{
    private static readonly string[] Mailbox =
    [
        "From: one@example.com\r\nSubject: One\r\n\r\nFirst",
        "From: two@example.com\r\nSubject: Two\r\n\r\nSecond",
        "From: three@example.com\r\nMessage-ID: <three@example.com>\r\nSubject: Three\r\n\r\nThird",
    ];

    [Fact]
    public async Task CheckAsync_Should_Authenticate_And_Open_Inbox()
    {
        await using var server = new ImapTestServer(Mailbox);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port);

        await service.CheckAsync(timeout.Token);

        Assert.Contains(
            server.Commands,
            command => command.Contains("LOGIN", StringComparison.Ordinal)
        );
        Assert.Contains(
            server.Commands,
            command => command.Contains("EXAMINE", StringComparison.Ordinal)
        );
    }

    [Fact]
    public async Task ReadAsync_Should_Read_Only_Two_Newest_Messages()
    {
        await using var server = new ImapTestServer(Mailbox);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port);

        var messages = await service.ReadAsync(timeout.Token);

        Assert.Equal(
            ["imap:1:3", "imap:1:2"],
            messages.Select(message => message.Id)
        );
        Assert.Equal("imap:1:3", messages[0].Id);
        Assert.Equal("three@example.com", messages[0].MessageId);
        Assert.Null(messages[1].MessageId);
        Assert.Contains(
            "Third",
            System.Text.Encoding.UTF8.GetString(messages[0].Raw)
        );
    }

    [Fact]
    public async Task ReadAsync_Should_Handle_Empty_Mailbox()
    {
        await using var server = new ImapTestServer([]);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port);

        Assert.Empty(await service.ReadAsync(timeout.Token));
    }

    [Fact]
    public async Task ReadAsync_Should_Use_Saved_Batch_Limit()
    {
        await using var server = new ImapTestServer(Mailbox);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port, maximum: 1);

        var messages = await service.ReadAsync(timeout.Token);

        Assert.Equal("imap:1:3", Assert.Single(messages).Id);
    }

    [Fact]
    public async Task ReadAsync_Should_Repair_Utf8_Subject_Decoded_As_Latin1()
    {
        string[] mailbox =
        [
            "From: orange@example.com\r\nSubject: Votre Mail Orange Ã©volue &#x20;\r\n\r\nBody",
        ];
        await using var server = new ImapTestServer(mailbox);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port);

        var source = Assert.Single(await service.ReadAsync(timeout.Token));
        using var stream = new MemoryStream(source.Raw);
        var message = await MimeMessage.LoadAsync(stream, timeout.Token);

        Assert.Equal("Votre Mail Orange évolue &#x20;", message.Subject);
    }

    [Fact]
    public async Task ReadAsync_Should_Preserve_Message_Without_Subject()
    {
        const string raw = "From: orange@example.com\r\n\r\nBody";
        await using var server = new ImapTestServer([raw]);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port);

        var source = Assert.Single(await service.ReadAsync(timeout.Token));

        Assert.Equal(System.Text.Encoding.UTF8.GetBytes(raw), source.Raw);
    }

    [Fact]
    public async Task Transfer_Should_Reuse_One_Imap_Connection()
    {
        await using var server = new ImapTestServer(Mailbox);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        await using var service = CreateService(server.Port);

        var messages = await service.ReadAsync(timeout.Token);
        foreach (var message in messages)
        {
            await service.MarkTransferredAsync(message.Id, timeout.Token);
        }

        await service.DisconnectAsync(timeout.Token);

        Assert.Equal(1, server.ConnectionCount);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MarkTransferredAsync_Should_Move_To_Existing_Or_New_Folder(
        bool folderExists
    )
    {
        await using var server = new ImapTestServer(Mailbox, folderExists);
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        var sourceId = "imap:1:3";
        await using var service = CreateService(server.Port);

        await service.MarkTransferredAsync(sourceId, timeout.Token);

        Assert.True(server.FolderExists);
        Assert.Contains(
            server.Commands,
            command => command.Contains("MOVE 3", StringComparison.Ordinal)
        );
    }

    [Fact]
    public async Task MarkTransferredAsync_Should_Reject_Changed_UidValidity()
    {
        await using var server = new ImapTestServer(Mailbox)
        {
            UidValidity = 2,
        };
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(10)
        );
        var sourceId = "imap:1:3";
        await using var service = CreateService(server.Port);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.MarkTransferredAsync(sourceId, timeout.Token)
        );

        Assert.DoesNotContain(
            server.Commands,
            command => command.Contains("MOVE", StringComparison.Ordinal)
        );
    }

    #region Private

    private static OrangeImapSourceService CreateService(
        int port,
        int? maximum = null
    )
    {
        var settings = CreateOrangeSettings() with { Port = port };
        return new OrangeImapSourceService(
            settings,
            CreateJobSettings(),
            new FakeJobOverridesStore { Current = new(null, maximum) },
            () =>
            {
                var client = new ImapClient
                {
                    ServerCertificateValidationCallback = (
                        _,
                        certificate,
                        _,
                        _
                    ) => certificate?.Subject == "CN=localhost",
                };
                client.AuthenticationMechanisms.Clear();
                return client;
            }
        );
    }

    #endregion
}
