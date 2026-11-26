using System.Net;

using MagicBeauty.Store.Api.Middleware;
using MagicBeauty.Store.Api.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public sealed class CorsOriginsTests
{
    private const string Production = "https://www.magicbeautycosmetics.com";
    private const string Pattern = "https://mango-beach-053c1c010-*.centralus.4.azurestaticapps.net";

    private static CorsOrigins Origins(string? pattern = Pattern) => new([Production, "https://magicbeautycosmetics.com"], pattern);

    [Theory]
    [InlineData("https://www.magicbeautycosmetics.com")]
    [InlineData("https://mango-beach-053c1c010-20.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010-develop.centralus.4.azurestaticapps.net")]
    [InlineData("HTTPS://MANGO-BEACH-053C1C010-21.CENTRALUS.4.AZURESTATICAPPS.NET")]
    public void AllowsProductionAndThePreviewsOfThisStaticWebApp(string origin)
    {
        Assert.True(Origins().IsAllowed(origin));
    }

    [Theory]
    [InlineData("https://evil-site.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010-20.evil.com")]
    [InlineData("https://mango-beach-053c1c010-20.evil.centralus.4.azurestaticapps.net")]
    [InlineData("https://x.mango-beach-053c1c010-20.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010-20.centralus.4.azurestaticapps.net.evil.com")]
    [InlineData("http://mango-beach-053c1c010-20.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010-20.centralus.4.azurestaticapps.net:8443")]
    [InlineData("https://other-app-053c1c010-20.centralus.4.azurestaticapps.net")]
    [InlineData("null")]
    [InlineData("")]
    public void RejectsAnyOtherSiteIncludingOtherStaticWebApps(string origin)
    {
        Assert.False(Origins().IsAllowed(origin));
    }

    [Fact]
    public void WithoutAPatternOnlyProductionIsAllowed()
    {
        var origins = Origins(pattern: null);

        Assert.True(origins.IsAllowed(Production));
        Assert.False(origins.IsAllowed("https://mango-beach-053c1c010-20.centralus.4.azurestaticapps.net"));
    }

    [Theory]
    [InlineData("https://*.azurestaticapps.net")]
    [InlineData("https://*.centralus.4.azurestaticapps.net")]
    [InlineData("https://*")]
    [InlineData("http://mango-beach-053c1c010-*.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-*-*.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010.centralus.4.azurestaticapps.net")]
    [InlineData("https://mango-beach-053c1c010-*.centralus.4.azurestaticapps.net/ruta")]
    public void RefusesToStartWithAPatternThatWouldOpenTheApiTooWide(string pattern)
    {
        Assert.Throws<InvalidOperationException>(() => Origins(pattern));
    }

    [Fact]
    public void KeepsOnlyProductionAsTheOriginsThatMayChangeData()
    {
        Assert.Equal(
            ["https://magicbeautycosmetics.com", Production],
            Origins().Exact.Order(StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void ReadsTheProductionListAndThePatternFromConfiguration()
    {
        // En el App Service: Cors__AllowedOrigins__0 y Cors__PreviewOriginPattern.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = Production,
                ["Cors:PreviewOriginPattern"] = Pattern
            })
            .Build();

        var origins = CorsOrigins.FromConfiguration(configuration);

        Assert.True(origins.IsAllowed("https://mango-beach-053c1c010-7.centralus.4.azurestaticapps.net"));
        Assert.Equal([Production], origins.Exact.ToArray());
    }

    [Fact]
    public async Task APreviewCanReadWithCredentialsButCannotChangeData()
    {
        await using var api = await StartAsync();
        const string Preview = "https://mango-beach-053c1c010-20.centralus.4.azurestaticapps.net";

        using var read = await api.SendAsync(HttpMethod.Get, "/api/catalog", Preview);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal(Preview, read.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", read.Headers.GetValues("Access-Control-Allow-Credentials").Single());

        using var write = await api.SendAsync(HttpMethod.Post, "/api/catalog", Preview);
        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);

        using var productionWrite = await api.SendAsync(HttpMethod.Post, "/api/catalog", Production);
        Assert.Equal(HttpStatusCode.OK, productionWrite.StatusCode);
    }

    [Fact]
    public async Task AnotherSiteGetsNoCorsHeaders()
    {
        await using var api = await StartAsync();

        using var read = await api.SendAsync(HttpMethod.Get, "/api/catalog", "https://evil-site.centralus.4.azurestaticapps.net");

        Assert.False(read.Headers.Contains("Access-Control-Allow-Origin"));
    }

    /// <summary>Mismo cableado que Program.cs: politica CORS + filtro anti-CSRF.</summary>
    private static async Task<TestHost> StartAsync()
    {
        var origins = Origins();
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddCors(options => options.AddPolicy("store", policy => policy
            .SetIsOriginAllowed(origins.IsAllowed)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

        var app = builder.Build();
        app.UseCors("store");
        app.UseMiddleware<CrossSiteRequestGuardMiddleware>(origins.Exact);
        app.MapGet("/api/catalog", () => Results.Ok());
        app.MapPost("/api/catalog", () => Results.Ok());
        await app.StartAsync();

        var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
        return new TestHost(app, new HttpClient { BaseAddress = new Uri(address) });
    }

    private sealed record TestHost(WebApplication App, HttpClient Client) : IAsyncDisposable
    {
        public Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, string origin)
        {
            var request = new HttpRequestMessage(method, path);
            request.Headers.Add("Origin", origin);
            return Client.SendAsync(request);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await App.StopAsync();
            await App.DisposeAsync();
        }
    }
}
