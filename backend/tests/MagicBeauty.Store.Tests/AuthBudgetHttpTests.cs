using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Api.Filters;
using MagicBeauty.Store.Api.Middleware;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Accounts;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Infrastructure.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

/// <summary>
/// La API real (Kestrel, AuthController, AccountService, EF Core y SqlClient) con la
/// base en memoria o con un SQL que no responde. Mide el tiempo que ve el navegador.
/// </summary>
public sealed class AuthBudgetHttpTests
{
    private const string Email = "cliente@example.invalid";
    private const string Password = "Clave-Segura-123";

    [Fact]
    public async Task LogsInQuicklyWhenTheDatabaseIsAvailable()
    {
        await using var api = await TestApi.StartAsync(InMemoryDatabase(), AuthRequestBudget.Default);
        var watch = Stopwatch.StartNew();

        using var response = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });

        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        Assert.Equal("AUTHENTICATED", (await ReadAsync(response)).GetProperty("status").GetString());
        Assert.Contains(response.Headers, header => header.Key == "Set-Cookie");
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(2), "Login con base activa: " + watch.Elapsed);
    }

    [Fact]
    public async Task WrongCredentialsKeepTheBusinessAnswer()
    {
        await using var api = await TestApi.StartAsync(InMemoryDatabase(), AuthRequestBudget.Default);

        using var response = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = "Clave-Incorrecta-1" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Correo o contrasena incorrectos.", (await ReadAsync(response)).GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/verify-email")]
    [InlineData("/api/auth/change-temporary-password")]
    public async Task SlowDatabaseEndsInAGeneric503WhenTheBudgetRunsOut(string path)
    {
        // Connect Timeout=30 como en Azure; el presupuesto (2 s en la prueba) corta antes.
        await using var sql = new UnresponsiveServer();
        await using var api = await TestApi.StartAsync(
            () => sql.CreateContext(DatabaseRetryPolicy.Default, connectTimeoutSeconds: 30),
            new AuthRequestBudget(TimeSpan.FromSeconds(2)));
        var watch = Stopwatch.StartNew();

        using var response = await api.Client.PostAsJsonAsync(path, new
        {
            email = Email,
            password = Password,
            code = "123456",
            temporaryPassword = Password,
            newPassword = "Otra-Clave-456"
        });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(ExceptionHandlingMiddleware.UnavailableMessage, JsonDocument.Parse(body).RootElement.GetProperty("error").GetString());
        Assert.DoesNotContain("Timeout", body);
        Assert.DoesNotContain("SqlException", body);
        Assert.Equal("30", response.Headers.RetryAfter?.ToString());
        Assert.InRange(watch.Elapsed, TimeSpan.FromSeconds(1.9), TimeSpan.FromSeconds(4));
        // Una sola apertura, cancelada por el presupuesto: no hubo reintento.
        Assert.Equal(1, sql.Connections);
    }

    [Fact]
    public async Task ClosingTheRequestCancelsTheLoginWhileTheConnectionIsOpening()
    {
        // Angular corta a los 15 s; aqui el "navegador" corta a los 0,5 s, con el
        // presupuesto del API (13 s) y el Connect Timeout (30 s) aun lejos.
        await using var sql = new UnresponsiveServer();
        var loginEnded = new TaskCompletionSource<(Exception? Failure, TimeSpan Elapsed)>();
        var watch = Stopwatch.StartNew();

        await using var api = await TestApi.StartAsync(
            () => sql.CreateContext(DatabaseRetryPolicy.Default, connectTimeoutSeconds: 30),
            AuthRequestBudget.Default,
            inner => ObserveLogin(inner, loginEnded, watch));
        using var browserTimeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password }, browserTimeout.Token));

        var (failure, elapsed) = await loginEnded.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.IsAssignableFrom<OperationCanceledException>(failure);
        Assert.True(elapsed < TimeSpan.FromSeconds(2), "El login siguio esperando a SQL: " + elapsed);
        Assert.Equal(1, sql.Connections);
    }

    /// <summary>Envuelve LoginAsync para saber cuando y como termino en el servidor.</summary>
    private static IAccountService ObserveLogin(
        IAccountService inner,
        TaskCompletionSource<(Exception? Failure, TimeSpan Elapsed)> ended,
        Stopwatch watch)
    {
        var observed = new Mock<IAccountService>();
        observed
            .Setup(service => service.LoginAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(async (string email, string password, CancellationToken cancellationToken) =>
            {
                try
                {
                    var result = await inner.LoginAsync(email, password, cancellationToken);
                    ended.TrySetResult((null, watch.Elapsed));
                    return result;
                }
                catch (Exception exception)
                {
                    ended.TrySetResult((exception, watch.Elapsed));
                    throw;
                }
            });

        return observed.Object;
    }

    [Fact]
    public async Task ABusinessErrorInsideTheBudgetIsNotTurnedInto503()
    {
        await using var api = await TestApi.StartAsync(InMemoryDatabase(), AuthRequestBudget.Default);

        using var response = await api.Client.PostAsJsonAsync("/api/auth/verify-email", new { email = Email, code = "000000" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static Func<MagicBeautyDbContext> InMemoryDatabase()
    {
        var name = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(name).Options;

        using (var seed = new MagicBeautyDbContext(options))
        {
            var role = new Role { Id = 1, Code = "ADMIN", Name = "Administrador" };
            var user = new User
            {
                Id = 1,
                Email = Email,
                PasswordHash = new IdentityPasswordHasher().Hash(Password),
                EmailConfirmedAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            user.UserRoles.Add(new UserRole { RoleId = role.Id, Role = role });
            seed.Add(user);
            seed.SaveChanges();
        }

        return () => new MagicBeautyDbContext(options);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }

    private sealed class TestApi : IAsyncDisposable
    {
        private readonly WebApplication app;

        private TestApi(WebApplication app, HttpClient client)
        {
            this.app = app;
            Client = client;
        }

        public HttpClient Client { get; }

        public static async Task<TestApi> StartAsync(
            Func<MagicBeautyDbContext> database,
            AuthRequestBudget budget,
            Func<IAccountService, IAccountService>? decorate = null)
        {
            // Raiz vacia: no se leen los appsettings reales de la API (hosts, secretos).
            var contentRoot = Directory.CreateTempSubdirectory("magicbeauty-api-").FullName;
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                EnvironmentName = "Development",
                ContentRootPath = contentRoot
            });
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Logging.ClearProviders();

            builder.Services.AddControllers().AddApplicationPart(typeof(AuthController).Assembly);
            builder.Services.AddStoreAuthentication(builder.Environment);
            builder.Services.AddAuthRequestBudget(budget);
            builder.Services.AddScoped(_ => database());
            builder.Services.AddScoped<IUserRepository, UserRepository>();
            builder.Services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
            builder.Services.AddSingleton(Mock.Of<IEmailSender>());
            builder.Services.AddScoped<AccountService>();
            builder.Services.AddScoped<IAccountService>(provider =>
                (decorate ?? (inner => inner))(provider.GetRequiredService<AccountService>()));

            var app = builder.Build();
            app.UseMiddleware<ExceptionHandlingMiddleware>();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            await app.StartAsync();

            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();

            return new TestApi(app, new HttpClient { BaseAddress = new Uri(address), Timeout = TimeSpan.FromSeconds(30) });
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }
}
