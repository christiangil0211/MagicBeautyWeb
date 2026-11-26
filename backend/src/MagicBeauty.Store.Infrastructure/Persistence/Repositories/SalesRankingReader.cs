using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class SalesRankingReader(MagicBeautyDbContext db) : ISalesRankingReader
{
    public async Task<IReadOnlyDictionary<int, decimal>> GetUnitsByProductAsync(
        DateOnly startDate, DateOnly endDate, CancellationToken cancellationToken) =>
        await (from sale in db.Set<Sale>().AsNoTracking()
               join line in db.Set<SaleLine>().AsNoTracking() on sale.Id equals line.SaleId
               where sale.SaleDate >= startDate && sale.SaleDate <= endDate && line.ProductId != null
                     && (sale.Status == SaleStatus.Open || sale.Status == SaleStatus.Closed)
               group line by line.ProductId into lines
               select new { Id = lines.Key!.Value, Units = lines.Sum(x => x.Quantity) })
            .ToDictionaryAsync(x => x.Id, x => x.Units, cancellationToken);
}
