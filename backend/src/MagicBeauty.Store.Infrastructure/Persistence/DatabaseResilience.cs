using System.Data.Common;
using System.Diagnostics;
using System.Runtime.CompilerServices;

using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace MagicBeauty.Store.Infrastructure.Persistence;

/// <summary>
/// Un reintento como maximo, y solo si el primer intento fallo rapido: un reintento
/// tras <see cref="RetryDelay"/> empieza solo si cabe antes de <see cref="RetryWindow"/>.
/// El limite total de una peticion no lo da esta politica sino el token de cancelacion
/// (presupuesto de autenticacion en el API, desconexion del navegador).
/// </summary>
public sealed record DatabaseRetryPolicy(int MaxRetryCount, TimeSpan RetryDelay, TimeSpan RetryWindow)
{
    /// <summary>
    /// Azure SQL rechaza con 40613 mientras se reactiva y recomienda esperar unos 5 s
    /// antes de reintentar. Si el primer intento fallo al instante, el segundo empieza
    /// a los 5 s y puede esperar dentro del presupuesto a que la base termine de
    /// reactivarse. Si el primero ya tardo mas de 3 s, no se reintenta.
    /// </summary>
    public static readonly DatabaseRetryPolicy Default =
        new(MaxRetryCount: 1, RetryDelay: TimeSpan.FromSeconds(5), RetryWindow: TimeSpan.FromSeconds(8));
}

/// <summary>
/// Reintenta solo los fallos de disponibilidad ocurridos al ABRIR la conexion. En ese
/// momento todavia no se envio ningun comando, de modo que repetir no puede duplicar
/// inserciones de inventario, productos ni codigos de verificacion. Un fallo a mitad
/// de una consulta o de un SaveChanges, o una cancelacion, se propagan sin reintento.
/// Deriva de la estrategia base publica de EF: la lista de errores es la nuestra.
/// </summary>
public sealed class ConnectionOpenRetryingExecutionStrategy : ExecutionStrategy
{
    private readonly DatabaseRetryPolicy policy;
    private readonly Stopwatch elapsed = new();

    public ConnectionOpenRetryingExecutionStrategy(
        ExecutionStrategyDependencies dependencies,
        DatabaseRetryPolicy policy)
        : base(dependencies, policy.MaxRetryCount, policy.RetryDelay)
    {
        this.policy = policy;
    }

    protected override void OnFirstExecution()
    {
        base.OnFirstExecution();
        elapsed.Restart();
    }

    protected override bool ShouldRetryOn(Exception exception)
    {
        return ConnectionOpenFailureInterceptor.FailedWhileOpening(exception) &&
               DatabaseAvailability.IsTransientSqlError(exception);
    }

    protected override TimeSpan? GetNextDelay(Exception lastException)
    {
        if (ExceptionsEncountered.Count > policy.MaxRetryCount)
        {
            return null;
        }

        return elapsed.Elapsed + policy.RetryDelay <= policy.RetryWindow ? policy.RetryDelay : null;
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
    /// <summary>SqlClient usa -2 para "Timeout expired", tanto al conectar como al ejecutar.</summary>
    public const int TimeoutErrorNumber = -2;

    /// <summary>
    /// Errores de disponibilidad de Azure SQL, explicitos y sin depender de APIs
    /// internas de EF Core. No incluye login fallido (18456), base inexistente ni
    /// errores de datos (clave duplicada, restricciones), que no se arreglan esperando.
    /// </summary>
    public static readonly IReadOnlySet<int> TransientErrorNumbers = new HashSet<int>
    {
        TimeoutErrorNumber,
        40613, // La base no esta disponible: serverless reactivandose o en conmutacion.
        40197, // Error del servicio al procesar la peticion (reconfiguracion).
        40501, // Servicio ocupado.
        49918, 49919, 49920, // Recursos insuficientes o demasiadas operaciones.
        64, 233, 10053, 10054, 10060 // Conexion cortada o rechazada por la red.
    };

    /// <summary>
    /// Reintentos agotados, timeouts y errores transitorios de SQL Server. Un
    /// TimeoutException solo cuenta si no lo envolvio una excepcion de negocio, que
    /// ya trae su propio mensaje.
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
        }

        return IsTransientSqlError(exception);
    }

    /// <summary>Algun SqlException de la cadena trae un error de <see cref="TransientErrorNumbers"/>.</summary>
    public static bool IsTransientSqlError(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqlException sql &&
                sql.Errors.Cast<SqlError>().Any(error => TransientErrorNumbers.Contains(error.Number)))
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
