using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;

namespace IMAPRemailer.Infrastructure.Email;

public sealed class GmailDestinationService(
    HttpClient httpClient,
    GmailSettings settings
) : IEmailDestinationService
{
    private string BaseUrl =>
        $"https://gmail.googleapis.com/gmail/v1/users/{Uri.EscapeDataString(settings.UserEmail)}";
    private static readonly string[] ImportedLabelIds = ["INBOX", "UNREAD"];
    private string? accessToken;
    private DateTimeOffset accessTokenExpiresAt;

    /// <inheritdoc />
    public async Task CheckAsync(CancellationToken cancellationToken)
    {
        using var request = await AuthorizedRequestAsync(
            HttpMethod.Get,
            $"{BaseUrl}/profile",
            cancellationToken
        );
        using var response = await httpClient.SendAsync(
            request,
            cancellationToken
        );
        response.EnsureSuccessStatusCode();
    }

    /// <inheritdoc />
    public async Task<bool> ExistsAsync(
        string messageId,
        CancellationToken cancellationToken
    )
    {
        var query = Uri.EscapeDataString($"rfc822msgid:{messageId}");
        using var request = await AuthorizedRequestAsync(
            HttpMethod.Get,
            $"{BaseUrl}/messages?maxResults=1&q={query}",
            cancellationToken
        );
        using var response = await httpClient.SendAsync(
            request,
            cancellationToken
        );
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(cancellationToken)
        );
        return document.RootElement.TryGetProperty("messages", out var messages)
            && messages.GetArrayLength() > 0;
    }

    /// <inheritdoc />
    public async Task ImportAsync(
        byte[] rawMessage,
        CancellationToken cancellationToken
    )
    {
        var raw = Convert
            .ToBase64String(rawMessage)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        using var request = await AuthorizedRequestAsync(
            HttpMethod.Post,
            $"{BaseUrl}/messages/import?internalDateSource=dateHeader",
            cancellationToken
        );
        request.Content = JsonContent.Create(
            new { raw, labelIds = ImportedLabelIds }
        );
        using var response = await httpClient.SendAsync(
            request,
            cancellationToken
        );
        response.EnsureSuccessStatusCode();
    }

    #region Private

    /// <summary>Creates a Gmail request with a cached or refreshed OAuth access token.</summary>
    /// <param name="method">The HTTP method for the Gmail request.</param>
    /// <param name="url">The Gmail API URL.</param>
    /// <param name="cancellationToken">Cancels token refresh.</param>
    /// <returns>An authorized HTTP request.</returns>
    private async Task<HttpRequestMessage> AuthorizedRequestAsync(
        HttpMethod method,
        string url,
        CancellationToken cancellationToken
    )
    {
        if (
            accessToken is null
            || DateTimeOffset.UtcNow >= accessTokenExpiresAt
        )
        {
            using var tokenRequest = new HttpRequestMessage(
                HttpMethod.Post,
                "https://oauth2.googleapis.com/token"
            )
            {
                Content = new FormUrlEncodedContent(
                    new Dictionary<string, string>
                    {
                        ["client_id"] = settings.ClientId,
                        ["client_secret"] = settings.ClientSecret,
                        ["refresh_token"] = settings.RefreshToken,
                        ["grant_type"] = "refresh_token",
                    }
                ),
            };
            using var tokenResponse = await httpClient.SendAsync(
                tokenRequest,
                cancellationToken
            );
            tokenResponse.EnsureSuccessStatusCode();
            using var token = JsonDocument.Parse(
                await tokenResponse.Content.ReadAsStringAsync(cancellationToken)
            );
            accessToken = token
                .RootElement.GetProperty("access_token")
                .GetString();
            accessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(
                token.RootElement.GetProperty("expires_in").GetInt32() - 60
            );
        }

        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );
        return request;
    }

    #endregion
}
