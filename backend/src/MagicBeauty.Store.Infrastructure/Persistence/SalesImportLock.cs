using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence;

/// <summary>Serializes worker execution and startup recovery across overlapping hosts.</summary>
public sealed class SalesImportLock : IAsyncDisposable
{
    private const string Resource = "MagicBeauty.SalesImport";
    private readonly MagicBeautyDbContext db;

    private SalesImportLock(MagicBeautyDbContext db) => this.db = db;

    public static async Task<SalesImportLock?> TryAcquireAsync(
        MagicBeautyDbContext db, int timeoutMilliseconds, CancellationToken token)
    {
        await db.Database.OpenConnectionAsync(token);
        var acquired = false;
        try
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = """
                DECLARE @result int;
                EXEC @result = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive',
                    @LockOwner = 'Session', @LockTimeout = @timeout;
                SELECT @result;
                """;
            var resource = command.CreateParameter();
            resource.ParameterName = "@resource";
            resource.Value = Resource;
            command.Parameters.Add(resource);
            var timeout = command.CreateParameter();
            timeout.ParameterName = "@timeout";
            timeout.Value = timeoutMilliseconds;
            command.Parameters.Add(timeout);
            acquired = (int)(await command.ExecuteScalarAsync(token))! >= 0;
            return acquired ? new SalesImportLock(db) : null;
        }
        finally
        {
            if (!acquired) await db.Database.CloseConnectionAsync();
        }
    }

    internal static async Task EnsureHeldAsync(MagicBeautyDbContext db, CancellationToken token)
    {
        if (!db.Database.IsSqlServer()) return;

        var mode = await db.Database
            .SqlQuery<string>($"SELECT APPLOCK_MODE(N'public', {Resource}, N'Session') AS [Value]")
            .SingleAsync(token);
        if (mode != "Exclusive")
            throw new InvalidOperationException("Se perdió el bloqueo SQL de la importación.");
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (db.Database.GetDbConnection().State == System.Data.ConnectionState.Open)
                await db.Database.ExecuteSqlAsync(
                    $"EXEC sp_releaseapplock @Resource = {Resource}, @LockOwner = 'Session';");
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }
}
