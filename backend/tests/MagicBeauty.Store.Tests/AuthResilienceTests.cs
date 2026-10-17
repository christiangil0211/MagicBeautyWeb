using System.Net;
using System.Net.Sockets;

using MagicBeauty.Store.Api.Middleware;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Accounts;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

/// <summary>
/// Login con la base disponible (en memoria) y con la base sin responder (SqlClient
/// real contra un servidor que no contesta). La reactivacion de Azure SQL serverless
/// no se puede reproducir aqui: ver DatabaseResilienceTests.
/// </summary>
public sealed class AuthResilienceTests
{
    private const string Email = "cliente@example.invalid";
    private const string Password = "Clave-Segura-123";

    [Fact]
    public async Task LogsInWhenTheDatabaseIsAvailable()
    {
        await using var db = await SeedAsync(emailConfirmed: true);
        var service = CreateService(db, Mock.Of<IEmailSender>());

        var result = await service.LoginAsync(Email, Password, default);

        Assert.Equal(LoginStatus.Authenticated, result.Status);
        Assert.Equal(["ADMIN"], result.Account!.RoleCodes);
        Assert.NotNull((await db.Users.SingleAsync()).LastLoginAt);
    }

    [Fact]
    public async Task WrongPasswordKeepsItsBusinessOutcome()
    {
        await using var db = await SeedAsync(emailConfirmed: true);
        var service = CreateService(db, Mock.Of<IEmailSender>());

        var result = await service.LoginAsync(Email, "Clave-Incorrecta-1", default);

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
        Assert.Equal(1, (await db.Users.SingleAsync()).FailedLoginCount);
    }

    [Fact]
    public async Task PersistentDatabaseFailureEndsInAGeneric503AfterBoundedRetries()
    {
        await using var server = new UnresponsiveServer();
        var policy = new DatabaseRetryPolicy(MaxRetryCount: 1, MaxRetryDelay: TimeSpan.FromMilliseconds(20), RetryWindow: TimeSpan.FromSeconds(30));
        await using var db = server.CreateContext(policy);
        var service = CreateService(db, Mock.Of<IEmailSender>());

        var (status, error, retryAfter) = await ExceptionHandlingMiddlewareTests.InvokeAsync(
            async _ => await service.LoginAsync(Email, Password, default));

        Assert.Equal(StatusCodes503, status);
        Assert.Equal(ExceptionHandlingMiddleware.UnavailableMessage, error);
        Assert.Equal("30", retryAfter);
        Assert.Equal(2, server.Connections); // Un intento y un reintento, nada mas.
    }

    [Fact]
    public async Task SmtpThatNeverAnswersFailsFastWithoutSavingTheCode()
    {
        using var smtp = new TcpListener(IPAddress.Loopback, 0);
        smtp.Start();
        _ = smtp.AcceptTcpClientAsync(); // Acepta y nunca saluda.

        var sender = new SmtpEmailSender(new SmtpEmailOptions
        {
            Host = "127.0.0.1",
            Port = ((IPEndPoint)smtp.LocalEndpoint).Port,
            EnableSsl = false,
            From = "tienda@example.invalid",
            TimeoutSeconds = 1
        });

        await using var db = await SeedAsync(emailConfirmed: false);
        var service = CreateService(db, sender);
        var started = DateTime.UtcNow;

        var (status, error, _) = await ExceptionHandlingMiddlewareTests.InvokeAsync(
            async _ => await service.LoginAsync(Email, Password, default));

        Assert.Equal(StatusCodes503, status);
        Assert.Equal(ExceptionHandlingMiddleware.UnavailableMessage, error);
        Assert.True(DateTime.UtcNow - started < TimeSpan.FromSeconds(10));
        // Igual que antes: si el correo no sale, no queda un codigo que el usuario no recibio.
        Assert.Empty(await db.EmailVerificationCodes.ToListAsync());
    }

    [Fact]
    public async Task SmtpTimeoutIsNotConfusedWithACallerCancellation()
    {
        var sender = new SmtpEmailSender(new SmtpEmailOptions { Host = "127.0.0.1", Port = 1, From = "tienda@example.invalid" });
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            sender.SendAsync("cliente@example.invalid", "Asunto", "Cuerpo", cancelled.Token));
    }

    private const int StatusCodes503 = (int)HttpStatusCode.ServiceUnavailable;

    private static AccountService CreateService(MagicBeautyDbContext db, IEmailSender sender)
    {
        return new AccountService(new UserRepository(db), new IdentityPasswordHasher(), sender);
    }

    private static async Task<MagicBeautyDbContext> SeedAsync(bool emailConfirmed)
    {
        var db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var role = new Role { Id = 1, Code = "ADMIN", Name = "Administrador" };
        var user = new User
        {
            Id = 1,
            Email = Email,
            PasswordHash = new IdentityPasswordHasher().Hash(Password),
            EmailConfirmedAt = emailConfirmed ? DateTime.UtcNow.AddDays(-1) : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        user.UserRoles.Add(new UserRole { RoleId = role.Id, Role = role });
        db.Add(user);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        return db;
    }
}
