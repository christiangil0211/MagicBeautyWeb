using System.Data.Common;
using System.Diagnostics;
using System.Runtime.CompilerServices;

using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace MagicBeauty.Store.Infrastructure.Persistence;

/// <summary>
/// Cuanto se insiste en abrir la conexion mientras Azure SQL serverless se reactiva
/// tras una pausa (del orden de un minuto). La ventana manda: no empieza un intento
/// nuevo pasado <see cref="RetryWindow"/>, asi que la espera maxima de una operacion
/// es la ventana mas un Connect Timeout (30 s en Azure).
/// </summary>
public sealed record DatabaseRetryPolicy(int MaxRetryCount, TimeSpan MaxRetryDelay, TimeSpan RetryWindow)
{
    /// <summary>
    /// EF Core 10 espera al menos 5 s antes de reintentar -2 y 40613, asi que las esperas
    /// reales son ~5, 6, 8, 12 y 15 s. Con timeouts de 30 s caben 3 intentos (0-30,
    /// 35-65 y 71-101 s); con 40613 inmediatos, unos 7 hasta el segundo 61. Peor caso
    /// ~105 s, por debajo del limite de 230 s de App Service.
    /// </summary>
    public static readonly DatabaseRetryPolicy Default =
        new(MaxRetryCount: 8, MaxRetryDelay: TimeSpan.FromSeconds(10), RetryWindow: TimeSpan.FromSeconds(75));
}

/// <summary>
/// Reintenta solo los fallos transitorios ocurridos al ABRIR la conexion. En ese
/// momento todavia no se envio ningun comando, de modo que repetir no puede duplicar
/// inserciones de inventario, productos ni codigos de verificacion. Un fallo a mitad
/// de una consulta o de un SaveChanges se propaga igual que antes.
/// </summary>
public sealed class ConnectionOpenRetryingExecutionStrategy : SqlServerRetryingExecutionStrategy
{
    /// <summary>SqlClient usa -2 para "Timeout expired", tanto al conectar como al ejecutar.</summary>
    public const int TimeoutErrorNumber = -2;

    private readonly TimeSpan retryWindow;
    private readonly Stopwatch elapsed = new();

    public ConnectionOpenRetryingExecutionStrategy(
        ExecutionStrategyDependencies dependencies,
        DatabaseRetryPolicy policy)
        // EF Core 10 no considera transitorio el -2; se agrega aqui y ShouldRetryOn
        // lo limita a la apertura, donde no hay comando que se pueda repetir.
        : base(dependencies, policy.MaxRetryCount, policy.MaxRetryDelay, [TimeoutErrorNumber])
    {
        retryWindow = policy.RetryWindow;
    }

    protected override void OnFirstExecution()
    {
        base.OnFirstExecution();
        elapsed.Restart();
    }

    protected override bool ShouldRetryOn(Exception exception)
    {
        return ConnectionOpenFailureInterceptor.FailedWhileOpening(exception) && base.ShouldRetryOn(exception);
    }

    protected override TimeSpan? GetNextDelay(Exception lastException)
    {
        var delay = base.GetNextDelay(lastException);

        return delay is { } value && elapsed.Elapsed + value <= retryWindow ? value : null;
    }
}

/// <summary>
/// Marca la excepcion cuando falla la apertura de la conexion (y no el cierre ni un
/// comando), para que la estrategia sepa que reintentar es seguro.
/// </summary>
public sealed class ConnectionOpenFailureInterceptor : DbConnectionInterceptor
{
    private const string MarkerKey = "MagicBeauty.ConnectionOpenFailed";

    private readonly ConditionalWeakTable<DbConnection, object> opening = new();

    public static bool FailedWhileOpening(Exception? exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current.Data[MarkerKey] is true)
            {
                return true;
            }
        }

        return false;
    }

    public override InterceptionResult ConnectionOpening(
        DbConnection connection,
        ConnectionEventData eventData,
        InterceptionResult result)
    {
        opening.AddOrUpdate(connection, eventData);
        return result;
    }

    public override ValueTask<InterceptionResult> ConnectionOpeningAsync(
        DbConnection connection,
        ConnectionEventData eventData,
        InterceptionResult result,
        CancellationToken cancellationToken = default)
    {
        opening.AddOrUpdate(connection, eventData);
        return ValueTask.FromResult(result);
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        opening.Remove(connection);
    }

    public override Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        opening.Remove(connection);
        return Task.CompletedTask;
    }

    public override void ConnectionFailed(DbConnection connection, ConnectionErrorEventData eventData)
    {
        MarkIfOpening(connection, eventData.Exception);
    }

    public override Task ConnectionFailedAsync(
        DbConnection connection,
        ConnectionErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        MarkIfOpening(connection, eventData.Exception);
        return Task.CompletedTask;
    }

    private void MarkIfOpening(DbConnection connection, Exception exception)
    {
        if (opening.Remove(connection))
        {
            exception.Data[MarkerKey] = true;
        }
    }
}

/// <summary>Clasifica los errores de base de datos que significan "no disponible por ahora".</summary>
public static class DatabaseAvailability
{
    /// <summary>
    /// Reintentos agotados, timeouts y errores transitorios de SQL Server (40613 base
    /// no disponible, 40501 limitacion, conexion cortada...). No incluye errores de
    /// negocio ni violaciones de restricciones. Un TimeoutException solo cuenta si no
    /// lo envolvio una excepcion de negocio, que ya trae su propio mensaje.
    /// </summary>
    public static bool IsTemporarilyUnavailable(Exception exception)
    {
        if (exception is TimeoutException)
        {
            return true;
        }

        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is RetryLimitExceededException)
            {
                return true;
            }

            if (current is SqlException sql &&
                (IsTimeout(sql) || IsTransient(sql)))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>Numeros de error SQL de la cadena, para el log tecnico (sin mensajes ni servidor).</summary>
    public static string DescribeSqlErrors(Exception exception)
    {
        var numbers = new List<int>();

        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqlException sql)
            {
                numbers.AddRange(sql.Errors.Cast<SqlError>().Select(error => error.Number));
            }
        }

        return numbers.Count == 0 ? "ninguno" : string.Join(",", numbers.Distinct());
    }

    private static bool IsTimeout(SqlException exception)
    {
        return exception.Errors.Cast<SqlError>().Any(error => error.Number == ConnectionOpenRetryingExecutionStrategy.TimeoutErrorNumber);
    }

    private static bool IsTransient(SqlException exception)
    {
        // Misma lista que usa la estrategia de reintentos de EF Core.
#pragma warning disable EF1001
        return Microsoft.EntityFrameworkCore.SqlServer.Storage.Internal.SqlServerTransientExceptionDetector.ShouldRetryOn(exception);
#pragma warning restore EF1001
    }
}

public static class DatabaseResilienceExtensions
{
    // Una sola instancia: la tabla de conexiones es segura entre hilos y evita que EF
    // vea opciones distintas en cada contexto.
    private static readonly ConnectionOpenFailureInterceptor OpenFailureInterceptor = new();

    /// <summary>SQL Server con reintentos solo al abrir la conexion y su registro visible en produccion.</summary>
    public static DbContextOptionsBuilder UseResilientSqlServer(
        this DbContextOptionsBuilder options,
        string? connectionString,
        DatabaseRetryPolicy policy)
    {
        return options
            .UseSqlServer(connectionString, sql => sql.ExecutionStrategy(
                dependencies => new ConnectionOpenRetryingExecutionStrategy(dependencies, policy)))
            .AddInterceptors(OpenFailureInterceptor)
            // EF lo registra como Information y produccion solo guarda Warning: sin esto
            // los reintentos serian invisibles en los logs de App Service.
            .ConfigureWarnings(warnings => warnings.Log((CoreEventId.ExecutionStrategyRetrying, Microsoft.Extensions.Logging.LogLevel.Warning)));
    }
}
