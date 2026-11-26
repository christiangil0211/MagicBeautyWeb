using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Contracts.Catalog.Responses;
using MagicBeauty.Store.Application.Features.Sales;
using Microsoft.Extensions.Caching.Memory;

namespace MagicBeauty.Store.Api.Sales;

public sealed class BestSellers(
    ISalesRankingReader sales, ICatalogService catalog, IMemoryCache cache,
    TimeProvider clock, IConfiguration configuration)
{
    private static readonly SemaphoreSlim CacheMissLock = new(1);

    public int DefaultDays => Math.Clamp(configuration.GetValue("Sales:RankingDays", 30), 1, 90);

    public async Task<IReadOnlyList<CatalogProductListItemDto>> GetAsync(
        int? categoryId, int days, int? top, CancellationToken token)
    {
        var products = await catalog.GetProductsAsync(null, categoryId, null, token);
        var totals = await GetTotalsAsync(days, token);
        return Order(products, totals, categoryId.HasValue).Take(top ?? int.MaxValue).ToArray();
    }

    internal static IEnumerable<CatalogProductListItemDto> Order(
        IEnumerable<CatalogProductListItemDto> products, IReadOnlyDictionary<int, decimal> totals, bool includeFill)
    {
        var candidates = products.DistinctBy(x => x.Id)
            .Where(x => !string.IsNullOrEmpty(x.MainImageUrl) && x.AvailableQuantity > 0 &&
                x.Prices.Any(price => price.PriceTypeCode == "RETAIL" && price.Amount > 0))
            .Select(product => (Product: product, Units: totals.GetValueOrDefault(product.Id)))
            .ToArray();

        foreach (var (product, _) in candidates.Where(x => x.Units > 0)
                     .OrderByDescending(x => x.Units).ThenBy(x => x.Product.Id))
        {
            product.IsBestSeller = true;
            yield return product;
        }

        if (!includeFill) yield break;

        foreach (var (product, _) in candidates.Where(x => x.Units <= 0))
        {
            product.IsBestSeller = false;
            yield return product;
        }
    }

    private sealed class DailyTotals(DateOnly day)
    {
        public DateOnly Day { get; } = day;
        public System.Collections.Concurrent.ConcurrentDictionary<int, IReadOnlyDictionary<int, decimal>> ByDays { get; } = new();
    }

    private bool TryGetTotals(DateOnly day, int days, out IReadOnlyDictionary<int, decimal>? totals)
    {
        totals = null;
        return cache.TryGetValue<DailyTotals>(SalesImportWorker.RankingCacheKey, out var entries)
            && entries?.Day == day && entries.ByDays.TryGetValue(days, out totals);
    }

    private async Task<IReadOnlyDictionary<int, decimal>> GetTotalsAsync(int days, CancellationToken token)
    {
        var today = SalesCalendar.Today(clock);
        if (TryGetTotals(today, days, out var cached)) return cached!;

        await CacheMissLock.WaitAsync(token);
        try
        {
            if (TryGetTotals(today, days, out cached)) return cached!;

            if (!cache.TryGetValue<DailyTotals>(SalesImportWorker.RankingCacheKey, out var entries) || entries?.Day != today)
            {
                entries = new DailyTotals(today);
                cache.Set(SalesImportWorker.RankingCacheKey, entries);
            }

            var totals = await sales.GetUnitsByProductAsync(today.AddDays(1 - days), today, token);
            // An invalidation may have removed this entry during the query. In that
            // case the result serves this request only and cannot repopulate the cache.
            entries.ByDays[days] = totals;
            return totals;
        }
        finally
        {
            CacheMissLock.Release();
        }
    }
}
