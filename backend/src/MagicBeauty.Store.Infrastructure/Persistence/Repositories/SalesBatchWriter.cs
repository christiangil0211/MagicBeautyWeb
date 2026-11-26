using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class SalesBatchWriter(MagicBeautyDbContext db, TimeProvider clock) : ISalesBatchWriter
{
    public Task WriteAsync(Guid runId, SalesBatch batch, CancellationToken cancellationToken) =>
        db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await SalesImportLock.EnsureHeldAsync(db, cancellationToken);
            var run = await db.Set<ImportRun>().SingleAsync(x => x.Id == runId, cancellationToken);
            if (run.Status != ImportStatus.Running)
                throw new InvalidOperationException("La importación ya no está activa.");

            if (run.AllPagesRead || run.NextOffset >= batch.NextOffset && !batch.Complete)
                return;

            var documents = batch.Sales.DistinctBy(x => x.ExternalId).ToArray();
            var ids = documents.Select(x => x.ExternalId).ToArray();
            var sales = await db.Set<Sale>().Include(x => x.Lines)
                .Where(x => x.Source == run.Source && ids.Contains(x.ExternalId))
                .ToDictionaryAsync(x => x.ExternalId, cancellationToken);
            var itemIds = documents.SelectMany(x => x.Lines).Select(x => x.ExternalItemId).Distinct().ToArray();
            var mappings = await db.Set<SourceItemMapping>()
                .Where(x => x.Source == run.Source && itemIds.Contains(x.ExternalItemId))
                .ToDictionaryAsync(x => x.ExternalItemId, x => x.ProductId, cancellationToken);

            foreach (var document in documents)
            {
                if (string.IsNullOrWhiteSpace(document.ExternalId) ||
                    document.SaleDate < run.From || document.SaleDate > run.Through)
                    throw new InvalidOperationException("La página contiene una factura inválida.");

                if (!sales.TryGetValue(document.ExternalId, out var sale))
                {
                    sale = new Sale { Source = run.Source, ExternalId = document.ExternalId };
                    db.Add(sale);
                }

                sale.SaleDate = document.SaleDate;
                sale.Status = document.Status;
                sale.ImportedAt = clock.GetUtcNow();
                db.RemoveRange(sale.Lines);
                sale.Lines.Clear();

                foreach (var line in document.Lines)
                {
                    if (string.IsNullOrWhiteSpace(line.ExternalItemId))
                        throw new InvalidOperationException("Una línea de venta carece de identificador.");

                    sale.Lines.Add(new SaleLine
                    {
                        ExternalItemId = line.ExternalItemId,
                        Name = line.Name,
                        Reference = line.Reference,
                        Quantity = line.Quantity,
                        ProductId = mappings.TryGetValue(line.ExternalItemId, out var productId) ? productId : null
                    });
                }

                if (run.LastSaleDate is null || document.SaleDate > run.LastSaleDate)
                    run.LastSaleDate = document.SaleDate;
            }

            run.Pages++;
            run.Invoices += documents.Length;
            run.NextOffset = batch.NextOffset;
            run.AllPagesRead = batch.Complete;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });

}
