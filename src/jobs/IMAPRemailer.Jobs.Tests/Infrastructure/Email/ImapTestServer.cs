using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Email;

internal sealed class ImapTestServer : IAsyncDisposable
{
    private readonly TcpListener listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource shutdown = new();
    private readonly X509Certificate2 certificate;
    private readonly RSA rsa;
    private readonly Task serverTask;
    private readonly IReadOnlyList<string> messages;

    public ImapTestServer(
        IReadOnlyList<string> messages,
        bool folderExists = true
    )
    {
        this.messages = messages;
        FolderExists = folderExists;
        rsa = RSA.Create(2048);
        var request = new CertificateRequest(
            "CN=localhost",
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1
        );
        using var generated = request.CreateSelfSigned(
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow.AddDays(1)
        );
        certificate = X509CertificateLoader.LoadPkcs12(
            generated.Export(X509ContentType.Pfx),
            null,
            X509KeyStorageFlags.UserKeySet | X509KeyStorageFlags.Exportable
        );
        listener.Start();
        Port = ((IPEndPoint)listener.LocalEndpoint).Port;
        serverTask = ServeAsync();
    }

    public int Port { get; }
    public uint UidValidity { get; set; } = 1;
    public bool FolderExists { get; private set; }
    public List<string> Commands { get; } = [];

    public async ValueTask DisposeAsync()
    {
        await shutdown.CancelAsync();
        listener.Stop();
        await serverTask;
        certificate.Dispose();
        rsa.Dispose();
        shutdown.Dispose();
    }

    #region Private

    private async Task ServeAsync()
    {
        try
        {
            while (!shutdown.IsCancellationRequested)
            {
                using var tcp = await listener.AcceptTcpClientAsync(
                    shutdown.Token
                );
                await ServeClientAsync(tcp);
            }
        }
        catch (OperationCanceledException)
            when (shutdown.IsCancellationRequested) { }
        catch (ObjectDisposedException) when (shutdown.IsCancellationRequested)
        { }
    }

    private async Task ServeClientAsync(TcpClient tcp)
    {
        using var stream = new SslStream(tcp.GetStream());
        await stream.AuthenticateAsServerAsync(
            certificate,
            false,
            SslProtocols.Tls12,
            false
        );
        using var reader = new StreamReader(
            stream,
            Encoding.UTF8,
            leaveOpen: true
        );
        using var writer = new StreamWriter(
            stream,
            new UTF8Encoding(false),
            leaveOpen: true
        )
        {
            NewLine = "\r\n",
            AutoFlush = true,
        };
        await writer.WriteLineAsync(
            "* OK [CAPABILITY IMAP4rev1 NAMESPACE UIDPLUS MOVE] Ready"
        );

        while (await reader.ReadLineAsync() is { } command)
        {
            Commands.Add(command);
            var split = command.Split(' ', 3);
            var tag = split[0];
            var verb = split[1].ToUpperInvariant();
            switch (verb)
            {
                case "CAPABILITY":
                    await writer.WriteLineAsync(
                        "* CAPABILITY IMAP4rev1 NAMESPACE UIDPLUS MOVE"
                    );
                    break;
                case "NAMESPACE":
                    await writer.WriteLineAsync(
                        "* NAMESPACE ((\"\" \"/\")) NIL NIL"
                    );
                    break;
                case "LIST":
                    if (
                        command.Contains(
                            "Transferred to Gmail",
                            StringComparison.Ordinal
                        )
                    )
                    {
                        if (FolderExists)
                        {
                            await writer.WriteLineAsync(
                                "* LIST (\\HasNoChildren) \"/\" \"Transferred to Gmail\""
                            );
                        }
                    }
                    else
                    {
                        await writer.WriteLineAsync(
                            "* LIST (\\HasNoChildren) \"/\" \"INBOX\""
                        );
                    }
                    break;
                case "EXAMINE":
                case "SELECT":
                    await writer.WriteLineAsync($"* {messages.Count} EXISTS");
                    await writer.WriteLineAsync("* FLAGS (\\Seen \\Deleted)");
                    await writer.WriteLineAsync(
                        $"* OK [UIDVALIDITY {UidValidity}]"
                    );
                    await writer.WriteLineAsync(
                        $"* OK [UIDNEXT {messages.Count + 1}]"
                    );
                    break;
                case "UID":
                    if (
                        split[2]
                            .StartsWith(
                                "SEARCH",
                                StringComparison.OrdinalIgnoreCase
                            )
                    )
                    {
                        await writer.WriteLineAsync(
                            "* SEARCH "
                                + string.Join(
                                    ' ',
                                    Enumerable.Range(1, messages.Count)
                                )
                        );
                    }
                    else if (
                        split[2]
                            .StartsWith(
                                "FETCH",
                                StringComparison.OrdinalIgnoreCase
                            )
                    )
                    {
                        var uid = int.Parse(
                            split[2].Split(' ')[1],
                            System.Globalization.CultureInfo.InvariantCulture
                        );
                        var raw = messages[uid - 1];
                        var byteCount = Encoding.UTF8.GetByteCount(raw);
                        await writer.WriteAsync(
                            $"* {uid} FETCH (UID {uid} BODY[] {{{byteCount}}}\r\n{raw}\r\n)\r\n"
                        );
                    }
                    break;
                case "CREATE":
                    FolderExists = true;
                    break;
                case "LOGOUT":
                    await writer.WriteLineAsync("* BYE Logging out");
                    await writer.WriteLineAsync($"{tag} OK LOGOUT completed");
                    return;
            }

            var status = verb switch
            {
                "EXAMINE" => "OK [READ-ONLY] EXAMINE completed",
                "SELECT" => "OK [READ-WRITE] SELECT completed",
                _ => $"OK {verb} completed",
            };
            await writer.WriteLineAsync($"{tag} {status}");
        }
    }

    #endregion
}
