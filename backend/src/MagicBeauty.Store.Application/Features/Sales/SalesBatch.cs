using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Sales;

public sealed record ImportedSale(string ExternalId, DateOnly SaleDate, SaleStatus Status, IReadOnlyList<ImportedSaleLine> Lines);

public sealed record ImportedSaleLine(string ExternalItemId, string? Reference, string? Name, decimal Quantity);

public sealed record SalesBatch(IReadOnlyList<ImportedSale> Sales, int NextOffset, bool Complete);

public interface ISalesBatchWriter
{
    Task WriteAsync(Guid runId, SalesBatch batch, CancellationToken cancellationToken);
}
