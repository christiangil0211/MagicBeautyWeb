using System.Data.Common;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.CompilerServices;

using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

/// <summary>
/// Que pasa con los sockets de una apertura cancelada. SqlClient abandona la espera al
/// instante pero termina el intento en segundo plano y cierra el socket al vencer el
/// Connect Timeout. Estas pruebas fijan que no se acumulan ni dependen del GC.
/// Corren solas: sin pool, los intentos abandonados ocupan el cupo global de SqlClient
/// para aperturas no agrupadas y afectarian a otras pruebas en paralelo.
/// </summary>
[Collection(nameof(CancelledConnectionTests))]
public sealed class CancelledConnectionTests
{
    private const int ConnectTimeoutSeconds = 2;

    [Theory]
    [InlineData(true)]  // Produccion: pool activado (valor por defecto).
    [InlineData(false)]
    public async Task CancelledOpensAreClosedBySqlClientAtTheConnectTimeout(bool pooling)
    {
        using var server = new SocketTracker();
        var connectionString = server.ConnectionString(pooling);
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>();
        options.UseResilientSqlServer(connectionString, DatabaseRetryPolicy.Default);

        try
        {
            // Intentos consecutivos, como un usuario que reintenta tras cada timeout.
            for (var attempt = 0; attempt < 6; attempt++)
            {
                await using var db = new MagicBeautyDbContext(options.Options);
                using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(250));
                var watch = Stopwatch.StartNew();

                await Assert.ThrowsAnyAsync<OperationCanceledException>(() => db.Brands.AnyAsync(cancellation.Token));
                Assert.True(watch.Elapsed < TimeSpan.FromSeconds(1.5), "La cancelacion no libero la peticion: " + watch.Elapsed);
            }

            if (pooling)
            {
                // El pool crea las conexiones de a una: las aperturas canceladas
                // comparten el mismo intento en curso.
                Assert.Equal(1, server.Accepted);
            }

            // Sin forzar el GC: los cierra SqlClient al vencer su Connect Timeout.
            Assert.True(
                await server.WaitUntilAllClosedAsync(TimeSpan.FromSeconds(ConnectTimeoutSeconds * 4 + 2)),
                $"Sockets abiertos: {server.Open} de {server.Accepted}");
        }
        finally
        {
            // Solo el pool de esta prueba; los de otras pruebas siguen en uso.
            using var connection = new SqlConnection(connectionString);
            SqlConnection.ClearPool(connection);
        }
    }

    [Fact]
    public async Task WithoutPoolingCancelledOpensHoldSqlClientsGlobalSlotUntilTheirConnectTimeout()
    {
        // Por que producción debe conservar el pool (valor por defecto): sin el, cada
        // apertura cancelada sigue ocupando el cupo global de aperturas no agrupadas.
        using var server = new SocketTracker();
        var connectionString = server.ConnectionString(pooling: false);

        for (var attempt = 0; attempt < 8; attempt++)
        {
            await using var connection = new SqlConnection(connectionString);
            using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(250));

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => connection.OpenAsync(cancellation.Token));
        }

        Assert.True(server.Open <= 8);
        Assert.True(
            await server.WaitUntilAllClosedAsync(TimeSpan.FromSeconds(ConnectTimeoutSeconds * 4 + 2)),
            $"Sockets abiertos: {server.Open} de {server.Accepted}");
    }

    [Fact]
    public async Task ACancelledOpenDoesNotLeaveTheConnectionMarkedAsOpening()
    {
        using var server = new SocketTracker();
        var interceptor = new ConnectionOpenFailureInterceptor();
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>();
        options.UseSqlServer(server.ConnectionString(pooling: false)).AddInterceptors(interceptor);
        await using var db = new MagicBeautyDbContext(options.Options);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(250));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => db.Brands.AnyAsync(cancellation.Token));

        // Si quedara marcada, un fallo posterior de esta conexion pasaria por fallo de apertura.
        var opening = (ConditionalWeakTable<DbConnection, object>)typeof(ConnectionOpenFailureInterceptor)
            .GetField("opening", BindingFlags.NonPublic | BindingFlags.Instance)!
            .GetValue(interceptor)!;
        Assert.False(opening.TryGetValue(db.Database.GetDbConnection(), out _));
    }

    /// <summary>
    /// Servidor que acepta y nunca responde, con accept y lecturas en hilos propios para
    /// no depender del ThreadPool, que SqlClient usa durante la apertura.
    /// </summary>
    private sealed class SocketTracker : IDisposable
    {
        private readonly Socket listener = new(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        private int accepted;
        private int closed;

        public SocketTracker()
        {
            listener.Bind(new IPEndPoint(IPAddress.Loopback, 0));
            listener.Listen(100);
            new Thread(AcceptLoop) { IsBackground = true }.Start();
        }

        public int Accepted => Volatile.Read(ref accepted);

        public int Open => Accepted - Volatile.Read(ref closed);

        public string ConnectionString(bool pooling) =>
            $"Server=tcp:127.0.0.1,{((IPEndPoint)listener.LocalEndPoint!).Port};Database=Prueba;User ID=prueba;Password=prueba;" +
            $"Connect Timeout={ConnectTimeoutSeconds};Encrypt=false;" +
            // NeverBlock: como PoolBlockingPeriod=Auto en un host de Azure SQL.
            (pooling ? "Pooling=true;PoolBlockingPeriod=NeverBlock" : "Pooling=false");

        public async Task<bool> WaitUntilAllClosedAsync(TimeSpan timeout)
        {
            var watch = Stopwatch.StartNew();

            while (Open > 0 && watch.Elapsed < timeout)
            {
                await Task.Delay(100);
            }

            return Open == 0;
        }

        private void AcceptLoop()
        {
            while (true)
            {
                Socket client;

                try
                {
                    client = listener.Accept();
                }
                catch (SocketException)
                {
                    return;
                }
                catch (ObjectDisposedException)
                {
                    return;
                }

                Interlocked.Increment(ref accepted);
                new Thread(() => DrainUntilClosed(client)) { IsBackground = true }.Start();
            }
        }

        /// <summary>Descarta lo que envia SqlClient; Receive devuelve 0 cuando el cliente cierra.</summary>
        private void DrainUntilClosed(Socket client)
        {
            var buffer = new byte[4096];

            try
            {
                while (client.Receive(buffer) > 0)
                {
                }
            }
            catch (SocketException)
            {
            }
            catch (ObjectDisposedException)
            {
            }

            Interlocked.Increment(ref closed);
            client.Dispose();
        }

        public void Dispose()
        {
            listener.Dispose();
        }
    }
}

[CollectionDefinition(nameof(CancelledConnectionTests), DisableParallelization = true)]
public sealed class CancelledConnectionTestsCollection;
