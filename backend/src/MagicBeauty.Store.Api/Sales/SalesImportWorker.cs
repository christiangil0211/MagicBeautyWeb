using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace MagicBeauty.Store.Api.Sales;

public sealed class SalesImportWorker(
    IServiceScopeFactory scopes, SalesImportQueue queue, TimeProvider clock,
    IMemoryCache cache, ILogger<SalesImportWorker> logger) : BackgroundService
{
    internal const string RankingCacheKey = "SalesRanking";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Startup only marks interrupted work. Only the channel can start an import.
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<MagicBeautyDbContext>();
            await db.Set<ImportRun>()
                .Where(x => x.Status == ImportStatus.Queued || x.Status == ImportStatus.Running)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(x => x.Status, ImportStatus.Failed)
                    .SetProperty(x => x.Active, (bool?)null)
                    .SetProperty(x => x.FinishedAt, clock.GetUtcNow())
                    .SetProperty(x => x.Error, "La aplicación se reinició. Reanuda la importación desde el administrador."),
                    stoppingToken);
            queue.MarkReady();
        }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            logger.LogError("No se pudo inicializar el estado de importación de ventas ({ErrorType}).", ex.GetType().Name);
            return;
        }

        await foreach (var id in queue.ReadAsync(stoppingToken))
        {
            try
            {
                await ImportAsync(id, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogWarning("La importación {RunId} falló ({ErrorType}).", id, ex.GetType().Name);
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    var db = scope.ServiceProvider.GetRequiredService<MagicBeautyDbContext>();
                    await db.Set<ImportRun>().Where(x => x.Id == id && x.Active == true)
                        .ExecuteUpdateAsync(update => update
                            .SetProperty(x => x.Status, ImportStatus.Failed)
                            .SetProperty(x => x.Active, (bool?)null)
                            .SetProperty(x => x.FinishedAt, clock.GetUtcNow())
                            .SetProperty(x => x.Error, "No se pudo completar el lote. Revisa la configuración y reanuda."),
                            stoppingToken);
                }
                catch (Exception persistenceError) when (!stoppingToken.IsCancellationRequested)
                {
                    logger.LogError("No se pudo guardar el estado de la importación {RunId} ({ErrorType}).", id, persistenceError.GetType().Name);
                }
            }
            finally
            {
                cache.Remove(RankingCacheKey);
            }
        }
    }

    private async Task ImportAsync(Guid id, CancellationToken token)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MagicBeautyDbContext>();
        var run = await db.Set<ImportRun>().AsNoTracking().SingleAsync(x => x.Id == id, token);
        var source = scope.ServiceProvider.GetServices<ISalesSource>()
            .Single(x => x.Source == run.Source && x.IsEnabled);
        var started = await db.Set<ImportRun>().Where(x => x.Id == id && x.Status == ImportStatus.Queued)
            .ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, ImportStatus.Running), token);
        if (started == 0) return;

        await CopyMappingsAsync(db, source, token);
        var writer = scope.ServiceProvider.GetRequiredService<ISalesBatchWriter>();
        var offset = run.NextOffset;

        if (!run.AllPagesRead)
        {
            while (true)
            {
                var batch = await source.ReadAsync(run.From, run.Through, offset, token);
                if (batch.NextOffset < offset || batch.NextOffset == offset && !batch.Complete)
                    throw new InvalidOperationException("El origen no avanzó al leer el lote.");

                await writer.WriteAsync(id, batch, token);
                if (batch.Complete) break;
                offset = batch.NextOffset;
            }
        }

        await db.Set<ImportRun>().Where(x => x.Id == id && x.Status == ImportStatus.Running)
            .ExecuteUpdateAsync(update => update
                .SetProperty(x => x.Status, ImportStatus.Succeeded)
                .SetProperty(x => x.Active, (bool?)null)
                .SetProperty(x => x.FinishedAt, clock.GetUtcNow()), token);
    }

    private static async Task CopyMappingsAsync(MagicBeautyDbContext db, ISalesSource source, CancellationToken token)
    {
        var external = await source.GetItemMappingsAsync(token);
        var productIds = external.Values.Distinct().ToArray();
        var products = (await db.Products.Where(x => productIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(token)).ToHashSet();
        var existing = await db.Set<SourceItemMapping>().Where(x => x.Source == source.Source)
            .ToDictionaryAsync(x => x.ExternalItemId, token);

        foreach (var (externalId, productId) in external)
        {
            if (!products.Contains(productId) || existing.ContainsKey(externalId)) continue;
            db.Add(new SourceItemMapping { Source = source.Source, ExternalItemId = externalId, ProductId = productId });
        }

        await db.SaveChangesAsync(token);
        await db.Set<SaleLine>().Where(line => line.ProductId == null &&
                db.Set<Sale>().Any(sale => sale.Id == line.SaleId && sale.Source == source.Source) &&
                db.Set<SourceItemMapping>().Any(link => link.Source == source.Source && link.ExternalItemId == line.ExternalItemId))
            .ExecuteUpdateAsync(update => update.SetProperty(line => line.ProductId, line =>
                db.Set<SourceItemMapping>().Where(link => link.Source == source.Source && link.ExternalItemId == line.ExternalItemId)
                    .Select(link => (int?)link.ProductId).FirstOrDefault()), token);
    }
}
