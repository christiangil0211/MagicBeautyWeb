using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/admin/sales")]
public sealed class AdminSalesController(MagicBeautyDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        DateOnly? from, DateOnly? through, SaleStatus? status, string? search,
        int page = 1, CancellationToken token = default)
    {
        const int pageSize = 25;

        if (page is < 1 or > 100_000 || from > through || (status.HasValue && !Enum.IsDefined(status.Value)))
            return BadRequest(new { message = "Revisa el periodo, estado y número de página." });

        var query = db.Set<Sale>().AsNoTracking();
        if (from.HasValue) query = query.Where(sale => sale.SaleDate >= from.Value);
        if (through.HasValue) query = query.Where(sale => sale.SaleDate <= through.Value);
        if (status.HasValue) query = query.Where(sale => sale.Status == status.Value);

        var term = search?.Trim();
        if (!string.IsNullOrEmpty(term))
            query = query.Where(sale => sale.ExternalId.Contains(term) ||
                sale.Lines.Any(line => line.ExternalItemId.Contains(term) ||
                    (line.Reference != null && line.Reference.Contains(term)) ||
                    (line.Name != null && line.Name.Contains(term))));

        var total = await query.CountAsync(token);
        var rows = await query.OrderByDescending(sale => sale.SaleDate).ThenByDescending(sale => sale.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(sale => new
            {
                sale.Id, sale.ExternalId, sale.SaleDate, sale.Status,
                LineCount = sale.Lines.Count, Units = sale.Lines.Sum(line => line.Quantity)
            }).ToListAsync(token);

        return Ok(new
        {
            total, page, pageSize,
            items = rows.Select(row => new { row.Id, row.ExternalId, row.SaleDate, status = row.Status.ToString(), row.LineCount, row.Units })
        });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Detail(long id, CancellationToken token)
    {
        var lines = await db.Set<Sale>().AsNoTracking().Where(sale => sale.Id == id)
            .Select(sale => new
            {
                sale.SaleDate, sale.DueDate, sale.PaymentForm, sale.PaymentMethod,
                lines = sale.Lines.OrderBy(line => line.Id)
                    .Select(line => new { line.Id, line.ExternalItemId, line.Reference, line.Name, line.Quantity, line.ProductId }).ToList()
            }).SingleOrDefaultAsync(token);

        if (lines is null) return NotFound();
        return Ok(lines);
    }
}
