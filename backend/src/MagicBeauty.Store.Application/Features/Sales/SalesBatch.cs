using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Sales;

public sealed record ImportedSale(string ExternalId, DateOnly SaleDate, SaleStatus Status, IReadOnlyList<ImportedSaleLine> Lines)
{
    public DateOnly? DueDate { get; init; }
    public string? PaymentForm { get; init; }
    public string? PaymentMethod { get; init; }
}

public sealed record ImportedSaleLine(string ExternalItemId, string? Reference, string? Name, decimal Quantity);

public sealed record SalesBatch(IReadOnlyList<ImportedSale> Sales, int NextOffset, bool Complete);

public interface ISalesBatchWriter
{
    Task WriteAsync(Guid runId, SalesBatch batch, CancellationToken cancellationToken);
}
