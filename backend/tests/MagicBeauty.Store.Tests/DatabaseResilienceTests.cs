using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Reflection;

using MagicBeauty.Store.Api.Filters;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

/// <summary>
/// Reintentos y cancelacion al abrir la conexion. El "servidor" acepta TCP y nunca
/// responde, de modo que SqlClient produce un timeout de conexion real (error -2),
/// como Azure SQL mientras se reactiva. No reproduce la reactivacion de Azure en si.
/// </summary>
public sealed class DatabaseResilienceTests
{
    private static readonly DatabaseRetryPolicy FastPolicy =
        new(MaxRetryCount: 1, RetryDelay: TimeSpan.FromMilliseconds(20), RetryWindow: TimeSpan.FromSeconds(30));

    [Fact]
    public void ProductionPolicyRetriesOnceAndFitsInsideTheAuthBudget()
    {
        var policy = DatabaseRetryPolicy.Default;

        Assert.Equal(1, policy.MaxRetryCount);
        Assert.Equal(TimeSpan.FromSeconds(5), policy.RetryDelay);
        // El reintento solo empieza si cabe dentro del presupuesto de autenticacion.
        Assert.True(policy.RetryWindow < AuthRequestBudget.Default.Timeout);
        // Angular espera 15 s: el API tiene que contestar antes.
        Assert.True(AuthRequestBudget.Default.Timeout < TimeSpan.FromSeconds(15));
    }

    [Fact]
    public async Task ConnectionTimeoutWhileOpeningIsARealMinusTwoAndIsRetriedForQueries()
    {
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(FastPolicy);

        var failure = await Assert.ThrowsAsync<RetryLimitExceededException>(() => db.Brands.AnyAsync());

        var sql = Assert.IsType<SqlException>(failure.InnerException);
        Assert.Equal(DatabaseAvailability.TimeoutErrorNumber, sql.Number);
        Assert.True(ConnectionOpenFailureInterceptor.FailedWhileOpening(sql));
        Assert.Equal(1 + FastPolicy.MaxRetryCount, server.Connections);
    }

    [Fact]
    public async Task SaveChangesIsRetriedOnlyBecauseNothingWasSentYet()
    {
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(FastPolicy);
        db.Brands.Add(new Brand { Name = "Prueba", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

        await Assert.ThrowsAsync<RetryLimitExceededException>(() => db.SaveChangesAsync());

        Assert.Equal(1 + FastPolicy.MaxRetryCount, server.Connections);
    }

    [Fact]
    public async Task RecoversWhenTheDatabaseAnswersOnTheSecondAttempt()
    {
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(FastPolicy);
        var attempts = 0;

        // Primer intento: apertura real que vence. Segundo: la base "ya desperto".
        var result = await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            attempts++;

            if (attempts == 1)
            {
                await db.Database.OpenConnectionAsync();
            }

            return "ok";
        });

        Assert.Equal("ok", result);
        Assert.Equal(2, attempts);
    }

    [Fact]
    public async Task DoesNotRetryWhenTheFirstAttemptWasAlreadySlow()
    {
        // Connect Timeout=1: el primer intento ya consumio mas que la ventana de 0,5 s.
        await using var server = new UnresponsiveServer();
        var policy = new DatabaseRetryPolicy(MaxRetryCount: 1, RetryDelay: TimeSpan.FromMilliseconds(20), RetryWindow: TimeSpan.FromSeconds(0.5));
        await using var db = server.CreateContext(policy);

        await Assert.ThrowsAsync<RetryLimitExceededException>(() => db.Brands.AnyAsync());

        Assert.Equal(1, server.Connections);
    }

    [Fact]
    public async Task NeverRetriesMoreThanTheConfiguredCount()
    {
        await using var server = new UnresponsiveServer();
        var policy = new DatabaseRetryPolicy(MaxRetryCount: 1, RetryDelay: TimeSpan.FromMilliseconds(20), RetryWindow: TimeSpan.FromMinutes(1));
        await using var db = server.CreateContext(policy);

        await Assert.ThrowsAsync<RetryLimitExceededException>(() => db.Brands.AnyAsync());

        Assert.Equal(2, server.Connections);
    }

    [Fact]
    public async Task CancellationStopsASlowOpenAtOnceWithoutRetrying()
    {
        // Connect Timeout=30, como en Azure: sin cancelacion la apertura esperaria 30 s.
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(DatabaseRetryPolicy.Default, connectTimeoutSeconds: 30);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(1));
        var watch = Stopwatch.StartNew();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => db.Brands.AnyAsync(cancellation.Token));

        Assert.InRange(watch.Elapsed, TimeSpan.FromSeconds(0.9), TimeSpan.FromSeconds(3));
        // Ni reintento ni apertura nueva despues de cancelar.
        await Task.Delay(TimeSpan.FromSeconds(1.5));
        Assert.Equal(1, server.Connections);
    }

    [Fact]
    public async Task CancellationAlsoInterruptsTheWaitBeforeTheRetry()
    {
        await using var server = new UnresponsiveServer();
        var policy = new DatabaseRetryPolicy(MaxRetryCount: 1, RetryDelay: TimeSpan.FromSeconds(30), RetryWindow: TimeSpan.FromMinutes(1));
        await using var db = server.CreateContext(policy);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(300));
        var attempts = 0;
        var watch = Stopwatch.StartNew();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            db.Database.CreateExecutionStrategy().ExecuteAsync<int>(_ =>
            {
                attempts++;
                throw SqlExceptions.Create(40613, openedConnection: false);
            }, cancellation.Token));

        Assert.Equal(1, attempts);
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(3));
    }

    [Theory]
    [InlineData(40613)] // Base no disponible: Azure SQL reactivandose.
    [InlineData(DatabaseAvailability.TimeoutErrorNumber)]
    public async Task TransientFailuresAfterTheConnectionOpenedAreNotRetried(int number)
    {
        // A mitad de un comando no se sabe si el servidor aplico la escritura: repetir
        // podria duplicar un movimiento de inventario o un codigo de verificacion.
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(FastPolicy);
        var attempts = 0;

        var failure = await Assert.ThrowsAsync<SqlException>(() =>
            db.Database.CreateExecutionStrategy().ExecuteAsync<int>(() =>
            {
                attempts++;
                throw SqlExceptions.Create(number);
            }));

        Assert.Equal(number, failure.Number);
        Assert.Equal(1, attempts);
    }

    [Theory]
    [InlineData(40613, true)]
    [InlineData(DatabaseAvailability.TimeoutErrorNumber, true)]
    [InlineData(18456, false)] // Login fallido: configuracion, no disponibilidad.
    [InlineData(4060, false)]  // Base inexistente o sin permiso: esperar no lo arregla.
    public async Task OpenFailuresAreRetriedOnlyWhenTransient(int number, bool retried)
    {
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(FastPolicy);
        var attempts = 0;

        var execution = db.Database.CreateExecutionStrategy().ExecuteAsync<int>(() =>
        {
            attempts++;
            throw SqlExceptions.Create(number, openedConnection: false);
        });

        if (retried)
        {
            await Assert.ThrowsAsync<RetryLimitExceededException>(() => execution);
            Assert.Equal(1 + FastPolicy.MaxRetryCount, attempts);
        }
        else
        {
            await Assert.ThrowsAsync<SqlException>(() => execution);
            Assert.Equal(1, attempts);
        }
    }

    [Theory]
    [InlineData(40613, true)]
    [InlineData(40501, true)]
    [InlineData(10054, true)]
    [InlineData(DatabaseAvailability.TimeoutErrorNumber, true)]
    [InlineData(18456, false)]
    [InlineData(4060, false)]
    [InlineData(2627, false)] // Clave duplicada.
    [InlineData(547, false)]  // Restriccion de clave foranea.
    [InlineData(0, false)]    // Cancelado por el usuario.
    public void ClassifiesOnlyAvailabilityErrorsAsTemporary(int number, bool unavailable)
    {
        Assert.Equal(unavailable, DatabaseAvailability.IsTemporarilyUnavailable(SqlExceptions.Create(number)));
    }

    [Fact]
    public void ReportsSqlErrorNumbersWithoutMessages()
    {
        var failure = new RetryLimitExceededException("agotado", SqlExceptions.Create(40613));

        Assert.Equal("40613", DatabaseAvailability.DescribeSqlErrors(failure));
    }
}

/// <summary>Acepta conexiones TCP y nunca contesta: un SQL Server que no termina de responder.</summary>
internal sealed class UnresponsiveServer : IAsyncDisposable
{
    private readonly TcpListener listener = new(IPAddress.Loopback, 0);
    private readonly List<TcpClient> clients = [];
    private readonly CancellationTokenSource stop = new();
    private readonly Task acceptLoop;
    private int connections;

    public UnresponsiveServer()
    {
        listener.Start();
        acceptLoop = AcceptAsync();
    }

    public int Connections => Volatile.Read(ref connections);


    public string ConnectionString(int connectTimeoutSeconds = 1) =>
        $"Server=tcp:127.0.0.1,{((IPEndPoint)listener.LocalEndpoint).Port};Database=Prueba;User ID=prueba;Password=prueba;" +
        // Con pool, como produccion; NeverBlock equivale a PoolBlockingPeriod=Auto en un host
        // de Azure SQL. Cada servidor usa un puerto propio, asi que cada prueba tiene su pool.
        // Sin pool, las aperturas canceladas ocuparian el cupo global de SqlClient para
        // aperturas no agrupadas y harian fallar a otras pruebas en paralelo.
        $"Connect Timeout={connectTimeoutSeconds};Pooling=true;PoolBlockingPeriod=NeverBlock;Encrypt=false";

    public MagicBeautyDbContext CreateContext(DatabaseRetryPolicy policy, int connectTimeoutSeconds = 1)
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>();
        options.UseResilientSqlServer(ConnectionString(connectTimeoutSeconds), policy);

        return new MagicBeautyDbContext(options.Options);
    }

    private async Task AcceptAsync()
    {
        try
        {
            while (!stop.IsCancellationRequested)
            {
                var client = await listener.AcceptTcpClientAsync(stop.Token);
                Interlocked.Increment(ref connections);

                lock (clients)
                {
                    clients.Add(client);
                }

            }
        }
        catch (OperationCanceledException)
        {
        }
    }

    public async ValueTask DisposeAsync()
    {
        stop.Cancel();
        listener.Stop();
        await acceptLoop;

        lock (clients)
        {
            clients.ForEach(client => client.Dispose());
        }
    }
}

/// <summary>SqlException con un numero de error dado; SqlClient no expone constructores publicos.</summary>
internal static class SqlExceptions
{
    public static SqlException Create(int number, bool openedConnection = true)
    {
        var errorConstructor = typeof(SqlError)
            .GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance)
            .OrderByDescending(constructor => constructor.GetParameters().Length)
            .First();

        var arguments = errorConstructor.GetParameters()
            .Select(parameter => parameter.Name switch
            {
                "infoNumber" => number,
                "errorMessage" => "Error simulado " + number,
                "server" => "servidor-de-prueba",
                "procedure" => string.Empty,
                _ when parameter.HasDefaultValue => parameter.DefaultValue,
                _ => parameter.ParameterType.IsValueType ? Activator.CreateInstance(parameter.ParameterType) : null
            })
            .ToArray();

        var collection = (SqlErrorCollection)Activator.CreateInstance(typeof(SqlErrorCollection), nonPublic: true)!;
        typeof(SqlErrorCollection)
            .GetMethod("Add", BindingFlags.NonPublic | BindingFlags.Instance)!
            .Invoke(collection, [errorConstructor.Invoke(arguments)]);

        var exception = (SqlException)typeof(SqlException)
            .GetMethod("CreateException", BindingFlags.NonPublic | BindingFlags.Static, [typeof(SqlErrorCollection), typeof(string)])!
            .Invoke(null, [collection, "16.0"])!;

        if (!openedConnection)
        {
            // Lo mismo que hace el interceptor cuando la apertura falla.
            exception.Data["MagicBeauty.ConnectionOpenFailed"] = true;
        }

        return exception;
    }
}
