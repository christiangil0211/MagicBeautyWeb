namespace MagicBeauty.Store.Application.Features.Sales;

public interface ISalesRankingReader
{
    Task<IReadOnlyDictionary<int, decimal>> GetUnitsByProductAsync(
        DateOnly from, DateOnly through, CancellationToken cancellationToken);
}
