using System.Net;
using System.Net.Sockets;
using System.Reflection;

using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

/// <summary>
/// Reintentos al abrir la conexion. El "servidor" acepta TCP y nunca responde, de modo
/// que SqlClient produce un timeout de conexion real (error -2), como el de Azure SQL
/// mientras se reactiva. No reproduce la reactivacion de Azure en si.
/// </summary>
public sealed class DatabaseResilienceTests
{
    private static readonly DatabaseRetryPolicy FastPolicy =
        // EF Core 10 impone 5 s antes de reintentar -2/40613: un solo reintento mantiene la suite rapida.
        new(MaxRetryCount: 1, MaxRetryDelay: TimeSpan.FromMilliseconds(20), RetryWindow: TimeSpan.FromSeconds(30));

    /// <summary>
    /// Lo que decide EF Core 10 por si solo: 40613 es transitorio y -2 no. Por eso la
    /// estrategia agrega -2, y solo para la apertura de la conexion.
    /// </summary>
    [Theory]
    [InlineData(40613, true)]
    [InlineData(ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber, false)]
    public void EfCoreDefaultTransientDetection(int number, bool transient)
    {
#pragma warning disable EF1001
        Assert.Equal(transient, Microsoft.EntityFrameworkCore.SqlServer.Storage.Internal.SqlServerTransientExceptionDetector.ShouldRetryOn(SqlExceptions.Create(number)));
#pragma warning restore EF1001
    }

    /// <summary>El presupuesto de DatabaseRetryPolicy.Default parte de esta espera minima.</summary>
    [Theory]
    [InlineData(40613)]
    [InlineData(ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber)]
    public void EfCoreWaitsAtLeastFiveSecondsBeforeRetryingResumeErrors(int number)
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>();
        options.UseSqlServer("Server=sin-uso;Database=sin-uso", sql => sql.ExecutionStrategy(
            dependencies => new DelayProbe(dependencies)));
        using var db = new MagicBeautyDbContext(options.Options);
        var probe = (DelayProbe)db.Database.CreateExecutionStrategy();

        var delay = probe.NextDelayAfter(SqlExceptions.Create(number));

        Assert.NotNull(delay);
        Assert.InRange(delay.Value, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(6));
    }

    private sealed class DelayProbe(ExecutionStrategyDependencies dependencies)
        : SqlServerRetryingExecutionStrategy(dependencies, 8, TimeSpan.FromMilliseconds(20), [ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber])
    {
        public TimeSpan? NextDelayAfter(Exception exception)
        {
            ExceptionsEncountered.Add(exception);
            return GetNextDelay(exception);
        }
    }

    [Fact]
    public void ProductionBudgetFitsBeforeAppServiceAndBrowserGiveUp()
    {
        // Ultimo intento posible: empieza al cierre de la ventana y dura un Connect Timeout (30 s en Azure).
        var worstCase = DatabaseRetryPolicy.Default.RetryWindow + TimeSpan.FromSeconds(30);

        Assert.True(worstCase <= TimeSpan.FromSeconds(105));
        Assert.True(worstCase < TimeSpan.FromSeconds(230)); // Limite de peticion de App Service.
    }

    [Fact]
    public async Task ConnectionTimeoutWhileOpeningIsARealMinusTwoAndIsRetriedForQueries()
    {
        await using var server = new UnresponsiveServer();
        await using var db = server.CreateContext(FastPolicy);

        var failure = await Assert.ThrowsAsync<RetryLimitExceededException>(() => db.Brands.AnyAsync());

        var sql = Assert.IsType<SqlException>(failure.InnerException);
        Assert.Equal(ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber, sql.Number);
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
    public async Task RecoversWhenTheDatabaseAnswersOnALaterAttempt()
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
    public async Task StopsStartingAttemptsOnceTheWindowIsSpent()
    {
        await using var server = new UnresponsiveServer();
        // Connect Timeout=1 y 5 s de espera minima de EF: el segundo intento empieza ~6 s
        // y el tercero empezaria ~12 s, fuera de la ventana de 8 s.
        var policy = new DatabaseRetryPolicy(MaxRetryCount: 8, MaxRetryDelay: TimeSpan.FromMilliseconds(20), RetryWindow: TimeSpan.FromSeconds(8));
        await using var db = server.CreateContext(policy);

        await Assert.ThrowsAsync<RetryLimitExceededException>(() => db.Brands.AnyAsync());

        Assert.Equal(2, server.Connections);
    }

    [Theory]
    [InlineData(40613)] // Base no disponible: Azure SQL reactivandose.
    [InlineData(ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber)]
    public async Task TransientFailuresAfterTheConnectionOpenedAreNotRetried(int number)
    {
        // A mitad de un comando no se sabe si el servidor aplico la escritura: repetir
        // podria duplicar un movimiento de inventario.
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
    [InlineData(ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber, true)]
    [InlineData(18456, false)] // Login fallido: configuracion, no disponibilidad.
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
    [InlineData(ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber, true)]
    [InlineData(18456, false)]
    [InlineData(2627, false)] // Clave duplicada.
    [InlineData(547, false)]  // Restriccion de clave foranea.
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

    public string ConnectionString =>
        $"Server=tcp:127.0.0.1,{((IPEndPoint)listener.LocalEndpoint).Port};Database=Prueba;User ID=prueba;Password=prueba;" +
        // Sin pool: cada intento abre una conexion nueva, como en Azure (PoolBlockingPeriod=Auto).
        "Connect Timeout=1;Pooling=false;Encrypt=false";

    public MagicBeautyDbContext CreateContext(DatabaseRetryPolicy policy)
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>();
        options.UseResilientSqlServer(ConnectionString, policy);

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
