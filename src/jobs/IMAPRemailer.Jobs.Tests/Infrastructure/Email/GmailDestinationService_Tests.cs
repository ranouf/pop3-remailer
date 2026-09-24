using System.Net;
using System.Text;
using System.Text.Json;
using IMAPRemailer.Infrastructure.Email;

namespace IMAPRemailer.Jobs.Tests.Infrastructure.Email;

public sealed class GmailDestinationService_Tests : BaseTest
{
    [Fact]
    public async Task CheckAsync_Should_Target_Configured_Account_And_Reuse_Access_Token()
    {
        var tokenRequests = 0;
        var authorizedRequests = 0;
        using var client = new HttpClient(
            new StubHandler(async request =>
            {
                if (request.RequestUri!.Host == "oauth2.googleapis.com")
                {
                    tokenRequests++;
                    var form = await request.Content!.ReadAsStringAsync();
                    Assert.Contains("refresh_token=refresh-token", form);
                    return JsonResponse(
                        """{"access_token":"token","expires_in":3600}"""
                    );
                }

                Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
                Assert.Equal("token", request.Headers.Authorization?.Parameter);
                Assert.Contains(
                    "gmail%40example.com",
                    request.RequestUri.AbsoluteUri,
                    StringComparison.OrdinalIgnoreCase
                );
                authorizedRequests++;
                return request.RequestUri.AbsolutePath.EndsWith(
                    "/profile",
                    StringComparison.Ordinal
                )
                    ? JsonResponse("""{"emailAddress":"gmail@example.com"}""")
                    : JsonResponse("{}");
            })
        );
        var gmail = new GmailDestinationService(client, CreateGmailSettings());

        await gmail.CheckAsync(CancellationToken.None);
        Assert.False(
            await gmail.ExistsAsync(
                "missing@example.com",
                CancellationToken.None
            )
        );

        Assert.Equal(1, tokenRequests);
        Assert.Equal(2, authorizedRequests);
    }

    [Fact]
    public async Task CheckAsync_Should_Propagate_Forbidden_Account()
    {
        using var client = new HttpClient(
            new StubHandler(request =>
                Task.FromResult(
                    request.RequestUri!.Host == "oauth2.googleapis.com"
                        ? JsonResponse(
                            """{"access_token":"token","expires_in":3600}"""
                        )
                        : new HttpResponseMessage(HttpStatusCode.Forbidden)
                )
            )
        );

        var gmail = new GmailDestinationService(client, CreateGmailSettings());
        await Assert.ThrowsAsync<HttpRequestException>(() =>
            gmail.CheckAsync(CancellationToken.None)
        );
    }

    [Theory]
    [InlineData("""{"messages":[{"id":"abc"}]}""", true)]
    [InlineData("""{"messages":[]}""", false)]
    public async Task ExistsAsync_Should_Read_Gmail_Search_Result(
        string responseBody,
        bool expected
    )
    {
        string? query = null;
        using var client = new HttpClient(
            new StubHandler(request =>
            {
                if (request.RequestUri!.Host == "oauth2.googleapis.com")
                {
                    return Task.FromResult(
                        JsonResponse(
                            """{"access_token":"token","expires_in":3600}"""
                        )
                    );
                }

                query = request.RequestUri.Query;
                return Task.FromResult(JsonResponse(responseBody));
            })
        );

        var result = await new GmailDestinationService(
            client,
            CreateGmailSettings()
        ).ExistsAsync("id@example.com", CancellationToken.None);

        Assert.Equal(expected, result);
        Assert.Contains("rfc822msgid", query);
    }

    [Fact]
    public async Task ImportAsync_Should_Use_Insert_Endpoint_With_Date_Source()
    {
        string? requestBody = null;
        using var client = new HttpClient(
            new StubHandler(async request =>
            {
                if (request.RequestUri!.Host == "oauth2.googleapis.com")
                {
                    return JsonResponse(
                        """{"access_token":"token","expires_in":3600}"""
                    );
                }

                Assert.Equal(HttpMethod.Post, request.Method);
                Assert.EndsWith("/messages", request.RequestUri.AbsolutePath);
                Assert.Equal(
                    "?internalDateSource=dateHeader",
                    request.RequestUri.Query
                );
                requestBody = await request.Content!.ReadAsStringAsync();
                return JsonResponse("""{"id":"gmail-id"}""");
            })
        );
        var raw = Encoding.UTF8.GetBytes("test message");

        await new GmailDestinationService(
            client,
            CreateGmailSettings()
        ).ImportAsync(raw, CancellationToken.None);

        using var document = JsonDocument.Parse(requestBody!);
        var root = document.RootElement;
        Assert.Equal(
            Convert
                .ToBase64String(raw)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_'),
            root.GetProperty("raw").GetString()
        );
        Assert.Equal("INBOX", root.GetProperty("labelIds")[0].GetString());
        Assert.Equal("UNREAD", root.GetProperty("labelIds")[1].GetString());
        Assert.False(root.TryGetProperty("internalDateSource", out _));
    }

    [Fact]
    public async Task ImportAsync_Should_Include_Gmail_Error_Response()
    {
        using var client = new HttpClient(
            new StubHandler(request =>
                Task.FromResult(
                    request.RequestUri!.Host == "oauth2.googleapis.com"
                        ? JsonResponse(
                            """{"access_token":"token","expires_in":3600}"""
                        )
                        : new HttpResponseMessage(HttpStatusCode.BadRequest)
                        {
                            Content = new StringContent(
                                "invalidArgument",
                                Encoding.UTF8,
                                "application/json"
                            ),
                        }
                )
            )
        );

        var exception = await Assert.ThrowsAsync<HttpRequestException>(() =>
            new GmailDestinationService(
                client,
                CreateGmailSettings()
            ).ImportAsync([1, 2, 3], CancellationToken.None)
        );

        Assert.Equal(HttpStatusCode.BadRequest, exception.StatusCode);
        Assert.Contains("invalidArgument", exception.Message);
    }

    [Fact]
    public async Task CheckAsync_Should_Refresh_Expired_Access_Token()
    {
        var tokenRequests = 0;
        using var client = new HttpClient(
            new StubHandler(request =>
            {
                if (request.RequestUri!.Host == "oauth2.googleapis.com")
                {
                    tokenRequests++;
                    return Task.FromResult(
                        JsonResponse(
                            """{"access_token":"token","expires_in":1}"""
                        )
                    );
                }
                return Task.FromResult(
                    JsonResponse("""{"emailAddress":"gmail@example.com"}""")
                );
            })
        );
        var gmail = new GmailDestinationService(client, CreateGmailSettings());

        await gmail.CheckAsync(CancellationToken.None);
        await gmail.CheckAsync(CancellationToken.None);

        Assert.Equal(2, tokenRequests);
    }

    [Fact]
    public async Task CheckAsync_Should_Propagate_OAuth_Failure()
    {
        using var client = new HttpClient(
            new StubHandler(_ =>
                Task.FromResult(
                    new HttpResponseMessage(HttpStatusCode.Unauthorized)
                )
            )
        );

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            new GmailDestinationService(
                client,
                CreateGmailSettings()
            ).CheckAsync(CancellationToken.None)
        );
    }

    #region Private

    private static HttpResponseMessage JsonResponse(string json) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(
                json,
                Encoding.UTF8,
                "application/json"
            ),
        };

    private sealed class StubHandler(
        Func<HttpRequestMessage, Task<HttpResponseMessage>> respond
    ) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        ) => respond(request);
    }

    #endregion
}
