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
using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Contracts.Auth.Responses;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Infrastructure.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
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
    [InlineData("ADMIN", false)]
    [InlineData("CUSTOMER_WHOLESALE", false)]
    [InlineData("ADMIN", true)]
    public async Task OpenSessionIsRejectedAfterAccountChanges(string roleCode, bool deactivate)
    {
        var database = InMemoryDatabase(roleCode);
        var clock = new SessionClock();
        await using var api = await TestApi.StartAsync(database, AuthRequestBudget.Default, clock: clock);
        using var login = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });
        login.EnsureSuccessStatusCode();
        var session = await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session");
        Assert.True(session!.IsAuthenticated);
        Assert.Equal(roleCode == "ADMIN", session.CanManageStore);

        await using (var update = database())
        {
            var user = await update.Users.Include(user => user.UserRoles).SingleAsync();
            if (deactivate)
            {
                user.IsActive = false;
            }
            else
            {
                user.UserRoles.Clear();
            }

            await update.SaveChangesAsync();
        }

        clock.Advance(TimeSpan.FromMinutes(4));
        Assert.True((await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session"))!.IsAuthenticated);
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.False((await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session"))!.IsAuthenticated);
    }

    [Fact]
    public async Task ACommercialSessionCannotReviewCommercialRequests()
    {
        await using var api = await TestApi.StartAsync(InMemoryDatabase("CUSTOMER_WHOLESALE"), AuthRequestBudget.Default);
        using var login = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });
        login.EnsureSuccessStatusCode();

        using var decision = await api.Client.PostAsJsonAsync("/api/admin/customers/role-requests/1/decision", new { approve = true });

        Assert.Equal(HttpStatusCode.Forbidden, decision.StatusCode);
    }

    [Fact]
    public async Task ForgotPasswordResponseDoesNotRevealWhetherTheAccountExists()
    {
        await using var api = await TestApi.StartAsync(InMemoryDatabase(), AuthRequestBudget.Default);
        using var known = await api.Client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        using var absent = await api.Client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "absent@example.invalid" });

        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(known.StatusCode, absent.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await absent.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PasswordResetUsesItsOwnCodeAndOnlyOneConcurrentUseSucceeds()
    {
        await using var db = await RelationalAccountsAsync();
        var hasher = new IdentityPasswordHasher();
        var user = new User
        {
            Email = Email, PasswordHash = hasher.Hash(Password),
            FailedLoginCount = 4, LockoutEndsAt = DateTime.UtcNow.AddMinutes(15)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var oldStamp = user.SecurityStamp;
        const string verificationCode = "000000";
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{user.Id}:{verificationCode}"));
        db.EmailVerificationCodes.Add(new EmailVerificationCode
        {
            UserId = user.Id, CodeHash = Convert.ToHexString(hash),
            CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        });
        await db.SaveChangesAsync();
        var sender = new Mock<IEmailSender>();
        string? body = null;
        sender.Setup(service => service.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Callback<string, string, string, CancellationToken>((_, _, message, _) => body = message);
        var accounts = new AccountService(new UserRepository(db), hasher, sender.Object);
        await Assert.ThrowsAsync<InvalidOperationException>(() => accounts.VerifyEmailAsync(Email, verificationCode, default));
        await accounts.SendPasswordResetCodeAsync(Email, default);
        await accounts.SendPasswordResetCodeAsync(Email, default);
        sender.Verify(service => service.SendAsync(Email, It.IsAny<string>(), It.IsAny<string>(), default), Times.Once);
        const string newPassword = "Mi-Nueva-Clave-123";
        var code = System.Text.RegularExpressions.Regex.Match(body!, @"\b[0-9]{6}\b").Value;
        var incorrectCode = code == verificationCode ? "999999" : verificationCode;
        await Assert.ThrowsAsync<InvalidOperationException>(() => accounts.ResetPasswordAsync(Email, incorrectCode, newPassword, default));

        // Dos ámbitos distintos compiten por el mismo UPDATE condicional.
        var connection = db.Database.GetConnectionString()!;
        var results = await Task.WhenAll(Task.Run(ResetAsync), Task.Run(ResetAsync));
        Assert.Single(results, result => result);
        db.ChangeTracker.Clear();
        var reset = await db.Users.SingleAsync();
        Assert.True(hasher.Verify(reset.PasswordHash, newPassword));
        Assert.NotNull(reset.EmailConfirmedAt);
        Assert.NotEqual(oldStamp, reset.SecurityStamp);
        Assert.Null(reset.LockoutEndsAt);
        Assert.Equal(0, reset.FailedLoginCount);
        Assert.True(await db.EmailVerificationCodes.AllAsync(candidate => candidate.ConsumedAt != null));
        Assert.Equal(1, (await db.EmailVerificationCodes.SingleAsync(candidate => candidate.Purpose == EmailCodePurpose.PasswordReset)).Attempts);

        async Task<bool> ResetAsync()
        {
            await using var scope = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>()
                .UseSqlite(connection).Options);
            try
            {
                await new AccountService(new UserRepository(scope), hasher, sender.Object)
                    .ResetPasswordAsync(Email, code, newPassword, default);
                return true;
            }
            catch (InvalidOperationException exception) when (exception.Message.Contains("código de recuperación"))
            {
                return false;
            }
        }
    }

    [Fact]
    public async Task RegistrationDoesNotIdentifyDuplicateAccounts()
    {
        var database = InMemoryDatabase();
        await using (var seed = database())
        {
            seed.Roles.Add(new Role { Id = 2, Code = "CUSTOMER_RETAIL", Kind = RoleKind.Commercial });
            await seed.SaveChangesAsync();
        }

        await using var api = await TestApi.StartAsync(database, AuthRequestBudget.Default);
        object Request(string email) => new
        {
            email, password = Password, fullName = "Cliente de prueba", phone = "3001234567",
            city = "Cali", privacyAccepted = true, policyVersion = "1.0"
        };

        using var existing = await api.Client.PostAsJsonAsync("/api/auth/register", Request(Email));
        using var created = await api.Client.PostAsJsonAsync("/api/auth/register", Request("new@example.invalid"));

        Assert.Equal(HttpStatusCode.Accepted, existing.StatusCode);
        Assert.Equal(existing.StatusCode, created.StatusCode);
        Assert.Equal(await existing.Content.ReadAsStringAsync(), await created.Content.ReadAsStringAsync());
        Assert.False(created.Headers.Contains("Set-Cookie"));
        await using var state = database();
        Assert.Equal(2, await state.Users.CountAsync());
        var user = await state.Users.SingleAsync(user => user.Email == "new@example.invalid");
        Assert.Equal(2, user.CommercialRoleId);
        Assert.Null(user.EmailConfirmedAt);
        var consent = await state.PrivacyConsents.SingleAsync();
        Assert.Equal("1.0", consent.PolicyVersion);
        Assert.False(consent.MarketingOptIn);
    }

    [Fact]
    public async Task ConfirmationLinksOnlyTheConsentedMatchingCustomerWithoutGrantingRequestedRole()
    {
        await using var db = await RelationalAccountsAsync();
        var customer = new Customer { Source = "test", ExternalId = "one", DocumentNumber = "001234", Name = "Cliente" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var repository = new UserRepository(db);
        var hasher = new IdentityPasswordHasher();
        var registration = new CustomerRegistrationService(repository, hasher, TimeProvider.System);
        var userId = await registration.RegisterAsync(new MagicBeauty.Store.Contracts.Auth.Requests.RegisterCustomerRequest
        {
            Email = "linked@example.invalid", FullName = "Cliente", Phone = "3001234567", City = "Cali",
            Password = Password, DocumentNumber = "001-234", RequestedRoleCode = "CUSTOMER_WHOLESALE",
            PrivacyAccepted = true, PolicyVersion = "1.0"
        }, null, default);
        var user = await db.Users.SingleAsync(candidate => candidate.Id == userId);
        Assert.Null(user.CustomerId);
        var sender = new Mock<IEmailSender>();
        string? body = null;
        sender.Setup(service => service.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Callback<string, string, string, CancellationToken>((_, _, message, _) => body = message);
        var accounts = new AccountService(repository, hasher, sender.Object);
        await accounts.SendRegistrationCodeAsync(user.Id, default);
        var code = System.Text.RegularExpressions.Regex.Match(body!, @"\b[0-9]{6}\b").Value;
        var account = await accounts.VerifyEmailAsync(user.Email, code, default);

        Assert.Equal(customer.Id, user.CustomerId);
        Assert.Equal(new[] { "CUSTOMER_RETAIL" }, account.RoleCodes);
        Assert.Equal(RoleRequestStatus.Pending, (await db.RoleRequests.SingleAsync()).Status);
    }

    [Fact]
    public async Task ResetAccessRevokesExistingSession()
    {
        var database = InMemoryDatabase();
        var clock = new SessionClock();
        await using var api = await TestApi.StartAsync(database, AuthRequestBudget.Default, clock: clock);
        using var login = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });
        login.EnsureSuccessStatusCode();
        await using (var update = database())
        {
            var previous = (await update.Users.AsNoTracking().SingleAsync()).SecurityStamp;
            var accounts = new AccountService(new UserRepository(update), new IdentityPasswordHasher(), Mock.Of<IEmailSender>());
            await accounts.ResetAccessAsync(1, 2, new AccessLinks(null, null), default);
            Assert.NotEqual(previous, (await update.Users.SingleAsync()).SecurityStamp);
        }

        clock.Advance(TimeSpan.FromMinutes(5));
        Assert.False((await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session"))!.IsAuthenticated);
    }

    [Fact]
    public async Task AbsoluteExpirationSurvivesSlidingRenewal()
    {
        var clock = new SessionClock();
        await using var api = await TestApi.StartAsync(InMemoryDatabase(), AuthRequestBudget.Default, clock: clock);
        using var login = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });
        login.EnsureSuccessStatusCode();
        for (var elapsed = 5; elapsed < 24; elapsed += 5)
        {
            clock.Advance(TimeSpan.FromHours(5));
            using var renewed = await api.Client.GetAsync("/api/auth/session");
            Assert.True((await renewed.Content.ReadFromJsonAsync<SessionDto>())!.IsAuthenticated);
            Assert.Contains(renewed.Headers, header => header.Key == "Set-Cookie");
        }

        clock.Advance(TimeSpan.FromHours(4));
        Assert.False((await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session"))!.IsAuthenticated);
    }

    [Fact]
    public async Task LogoutRemovesTheBrowserSession()
    {
        await using var api = await TestApi.StartAsync(InMemoryDatabase(), AuthRequestBudget.Default);
        using var login = await api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });
        login.EnsureSuccessStatusCode();
        Assert.True((await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session"))!.IsAuthenticated);
        using var logout = await api.Client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.False((await api.Client.GetFromJsonAsync<SessionDto>("/api/auth/session"))!.IsAuthenticated);
    }

    private sealed class SessionClock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.UtcNow;

        public override DateTimeOffset GetUtcNow() => now;

        public void Advance(TimeSpan elapsed) => now += elapsed;
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
        await using var sql = new UnresponsiveServer();
        var loginEnded = new TaskCompletionSource<(Exception? Failure, TimeSpan Elapsed)>();
        var watch = new Stopwatch();

        await using var api = await TestApi.StartAsync(
            () => sql.CreateContext(DatabaseRetryPolicy.Default, connectTimeoutSeconds: 30),
            AuthRequestBudget.Default,
            inner => ObserveLogin(inner, loginEnded, watch));
        using var browserCancellation = new CancellationTokenSource();
        var login = api.Client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password }, browserCancellation.Token);

        // Cancela cuando SqlClient ya abrió el socket y todavía espera a SQL.
        // El arranque de Kestrel y la primera consulta de EF no cuentan como latencia de cancelación.
        await sql.FirstConnection.WaitAsync(TimeSpan.FromSeconds(5));
        watch.Start();
        browserCancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => login);

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

    private static Func<MagicBeautyDbContext> InMemoryDatabase(string roleCode = "ADMIN")
    {
        var name = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(name).Options;

        using (var seed = new MagicBeautyDbContext(options))
        {
            var role = new Role { Id = 1, Code = roleCode, Name = roleCode };
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

    private static async Task<MagicBeautyDbContext> RelationalAccountsAsync()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseSqlite($"Data Source={Guid.NewGuid():N};Mode=Memory;Cache=Shared").Options;
        var db = new MagicBeautyDbContext(options);
        await db.Database.OpenConnectionAsync();
        // SQLite ejecuta las transacciones y los UPDATE condicionales. SQL Server genera rowversion por sí mismo.
        var schema = db.Database.GenerateCreateScript().Replace(
            "\"RowVersion\" BLOB NOT NULL", "\"RowVersion\" BLOB NOT NULL DEFAULT X'00'", StringComparison.Ordinal);
        await db.Database.ExecuteSqlRawAsync(schema);
        return db;
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
            Func<IAccountService, IAccountService>? decorate = null,
            TimeProvider? clock = null)
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
            // El ticket se protege de verdad con claves aisladas del perfil de Windows.
            builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
            builder.Services.AddStoreAuthentication(builder.Environment, builder.Configuration);
            if (clock is not null)
            {
                builder.Services.Configure<CookieAuthenticationOptions>(
                    CookieAuthenticationDefaults.AuthenticationScheme, options => options.TimeProvider = clock);
            }
            builder.Services.AddAuthRequestBudget(budget);
            builder.Services.AddScoped(_ => database());
            builder.Services.AddScoped<IUserRepository, UserRepository>();
            builder.Services.AddSingleton(TimeProvider.System);
            builder.Services.AddSingleton<AccountCodeQueue>();
            builder.Services.AddScoped<CustomerRegistrationService>();
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
