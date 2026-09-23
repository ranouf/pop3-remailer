using System.Globalization;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Core.Email.Models;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using MimeKit;

namespace IMAPRemailer.Infrastructure.Email;

public sealed class OrangeImapSourceService(
    OrangeSettings orangeSettings,
    JobSettings jobSettings,
    IJobOverridesStore overridesStore,
    Func<ImapClient> clientFactory
) : IEmailSourceService, IAsyncDisposable
{
    private ImapClient? client;

    /// <inheritdoc />
    public async Task CheckAsync(CancellationToken cancellationToken)
    {
        var client = await ConnectAsync(cancellationToken);
        await client.Inbox.OpenAsync(FolderAccess.ReadOnly, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<SourceEmail>> ReadAsync(
        CancellationToken cancellationToken
    )
    {
        var client = await ConnectAsync(cancellationToken);
        var inbox = client.Inbox;
        await inbox.OpenAsync(FolderAccess.ReadOnly, cancellationToken);
        var uids = await inbox.SearchAsync(SearchQuery.All, cancellationToken);
        var overrides = await overridesStore.GetAsync(cancellationToken);
        var messages = new List<SourceEmail>();
        foreach (
            var uid in uids.OrderByDescending(uid => uid.Id)
                .Take(
                    overrides.MaxMessagesPerRun ?? jobSettings.MaxMessagesPerRun
                )
        )
        {
            using var stream = await inbox.GetStreamAsync(
                uid,
                cancellationToken
            );
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, cancellationToken);
            var sourceId = FormattableString.Invariant(
                $"imap:{inbox.UidValidity}:{uid.Id}"
            );
            var raw = buffer.ToArray();
            using var messageStream = new MemoryStream(raw);
            var parsed = await MimeMessage.LoadAsync(
                messageStream,
                cancellationToken
            );
            messages.Add(new SourceEmail(sourceId, parsed.MessageId, raw));
        }

        return messages;
    }

    /// <inheritdoc />
    public async Task MarkTransferredAsync(
        string sourceId,
        CancellationToken cancellationToken
    )
    {
        var identifiers = sourceId.Split(':');
        var uidValidity = uint.Parse(
            identifiers[1],
            CultureInfo.InvariantCulture
        );
        var uid = uint.Parse(identifiers[2], CultureInfo.InvariantCulture);
        var client = await ConnectAsync(cancellationToken);
        var inbox = client.Inbox;
        await inbox.OpenAsync(FolderAccess.ReadWrite, cancellationToken);
        if (inbox.UidValidity != uidValidity)
        {
            throw new InvalidOperationException(
                "Orange inbox UID validity changed before the message could be moved."
            );
        }

        IMailFolder? destination;
        try
        {
            destination = await client.GetFolderAsync(
                orangeSettings.TransferredFolder,
                cancellationToken
            );
        }
        catch (FolderNotFoundException)
        {
            destination = null;
        }
        if (destination is null)
        {
            var personalRoot = client.GetFolder(client.PersonalNamespaces[0]);
            destination = (
                await personalRoot.CreateAsync(
                    orangeSettings.TransferredFolder,
                    true,
                    cancellationToken
                )
            )!;
        }

        await inbox.MoveToAsync(
            new UniqueId(uid),
            destination,
            cancellationToken
        );
    }

    /// <inheritdoc />
    public async Task DisconnectAsync(CancellationToken cancellationToken)
    {
        if (client is null)
        {
            return;
        }

        try
        {
            if (client.IsConnected)
            {
                await client.DisconnectAsync(true, cancellationToken);
            }
        }
        finally
        {
            client.Dispose();
            client = null;
        }
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync(CancellationToken.None);
    }

    #region Private

    /// <summary>Connects and authenticates with the Orange IMAP server over TLS.</summary>
    /// <param name="cancellationToken">Cancels the connection.</param>
    /// <returns>An authenticated IMAP client.</returns>
    private async Task<ImapClient> ConnectAsync(
        CancellationToken cancellationToken
    )
    {
        if (client is not null)
        {
            return client;
        }

        client = clientFactory();
        client.Timeout = orangeSettings.TimeoutMs;
        await client.ConnectAsync(
            orangeSettings.Host,
            orangeSettings.Port,
            SecureSocketOptions.SslOnConnect,
            cancellationToken
        );
        await client.AuthenticateAsync(
            orangeSettings.Username,
            orangeSettings.Password,
            cancellationToken
        );
        return client;
    }

    #endregion
}
