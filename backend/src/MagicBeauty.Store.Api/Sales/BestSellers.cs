using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Contracts.Catalog.Responses;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace MagicBeauty.Store.Api.Sales;

public sealed class BestSellers(
    MagicBeautyDbContext db, ICatalogService catalog, IMemoryCache cache,
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

    private async Task<IReadOnlyDictionary<int, decimal>> GetTotalsAsync(int days, CancellationToken token)
    {
        var today = SalesCalendar.Today(clock);
        var key = (today, days);
        var entries = GetEntries();
        if (entries.TryGetValue(key, out var cached)) return cached;

        await CacheMissLock.WaitAsync(token);
        try
        {
            entries = GetEntries();
            if (entries.TryGetValue(key, out cached)) return cached;

            var startDate = today.AddDays(1 - days);
            var totals = await (from sale in db.Set<Sale>().AsNoTracking()
                                join line in db.Set<SaleLine>().AsNoTracking() on sale.Id equals line.SaleId
                                where sale.SaleDate >= startDate && sale.SaleDate <= today && line.ProductId != null
                                      && (sale.Status == SaleStatus.Open || sale.Status == SaleStatus.Closed)
                                group line by line.ProductId into lines
                                select new { Id = lines.Key!.Value, Units = lines.Sum(x => x.Quantity) })
                .ToDictionaryAsync(x => x.Id, x => x.Units, token);
            entries[key] = totals;
            return totals;
        }
        finally
        {
            CacheMissLock.Release();
        }
    }

    private System.Collections.Concurrent.ConcurrentDictionary<(DateOnly, int), IReadOnlyDictionary<int, decimal>> GetEntries() =>
        cache.GetOrCreate(SalesImportWorker.RankingCacheKey,
            _ => new System.Collections.Concurrent.ConcurrentDictionary<(DateOnly, int), IReadOnlyDictionary<int, decimal>>())!;
}
