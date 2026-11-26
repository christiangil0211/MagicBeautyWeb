namespace MagicBeauty.Store.Application.Features.Sales;

public interface ISalesSource
{
    string Source { get; }
    bool IsEnabled { get; }
    Task<IReadOnlyDictionary<string, int>> GetItemMappingsAsync(CancellationToken cancellationToken);
    Task<SalesBatch> ReadAsync(DateOnly from, DateOnly through, int offset, CancellationToken cancellationToken);
}
