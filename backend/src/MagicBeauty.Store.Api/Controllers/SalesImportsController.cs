using MagicBeauty.Store.Api.Sales;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/admin/sales/imports")]
public sealed class SalesImportsController(
    MagicBeautyDbContext db, IEnumerable<ISalesSource> sources, SalesImportQueue queue,
    TimeProvider clock, IConfiguration configuration) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Start(
        [FromQuery] Guid? resumeId, CancellationToken token, [FromQuery] bool refreshDetails = false,
        [FromQuery] DateOnly? backfillFrom = null)
    {
        if (!queue.Ready.IsCompletedSuccessfully)
            return StatusCode(503, new { message = "La importación de ventas no está disponible." });

        var active = await ActiveAsync(token);
        if (active is not null) return AlreadyActive(active);

        var source = sources.SingleOrDefault(x => x.IsEnabled);
        if (source is null)
            return StatusCode(503, new { message = "No hay una fuente de ventas habilitada." });

        var runId = resumeId ?? Guid.NewGuid();
        var today = SalesCalendar.Today(clock);
        if (backfillFrom > today || (backfillFrom is not null && resumeId is not null))
            throw new ArgumentException("La fecha de recarga no es válida para esta importación.");
        try
        {
            if (resumeId is { } id)
            {
                var failed = await SalesRuns().SingleOrDefaultAsync(x => x.Id == id, token);
                if (failed is null || failed.Source != source.Source || failed.Status != ImportStatus.Failed)
                {
                    active = await ActiveAsync(token);
                    if (active is not null) return AlreadyActive(active);
                    return BadRequest(new { message = "La ejecución solicitada no se puede reanudar." });
                }

                var newer = await SalesRuns().AnyAsync(
                    x => x.Source == failed.Source && x.StartedAt > failed.StartedAt, token);
                if (newer) return Conflict(new { message = "Hay una importación posterior. Inicia una nueva carga." });

                var queued = await db.Set<ImportRun>().Where(x => x.Id == id && x.Status == ImportStatus.Failed)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(x => x.Status, ImportStatus.Queued)
                        .SetProperty(x => x.Active, true)
                        .SetProperty(x => x.FinishedAt, (DateTimeOffset?)null)
                        .SetProperty(x => x.Error, (string?)null), token);
                if (queued == 0) return AlreadyActive(failed);
            }
            else
            {
                var last = await LastSuccessAsync(source.Source, token);
                var watermark = await SalesRuns()
                    .Where(x => x.Source == source.Source && x.Status == ImportStatus.Succeeded)
                    .MaxAsync(x => x.LastSaleDate, token);
                var overlap = Math.Clamp(configuration.GetValue("Sales:OverlapDays", 7), 0, 90);
                db.Add(new ImportRun
                {
                    Id = runId,
                    Source = source.Source,
                    From = backfillFrom ?? (last is null || refreshDetails
                        ? today.AddMonths(-3) : (watermark ?? last.Through).AddDays(-overlap)),
                    Through = today,
                    CapturesCustomerEvidence = true,
                    StartedAt = clock.GetUtcNow(),
                    Status = ImportStatus.Queued,
                    Active = true
                });
                await db.SaveChangesAsync(token);
            }
        }
        catch (Exception exception) when (exception is SqlException { Number: 2601 or 2627 } || exception is DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } })
        {
            active = await ActiveAsync(token);
            return active is not null ? AlreadyActive(active) : Conflict();
        }

        queue.Enqueue(runId);
        return AcceptedAtAction(nameof(Get), new { id = runId }, new { id = runId });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken token)
    {
        var run = await SalesRuns().SingleOrDefaultAsync(x => x.Id == id, token);
        return await DescribeAsync(run, token);
    }

    [HttpGet("latest")]
    public async Task<IActionResult> Latest(CancellationToken token)
    {
        var run = await SalesRuns().OrderByDescending(x => x.Active)
            .ThenByDescending(x => x.StartedAt).FirstOrDefaultAsync(token);
        return await DescribeAsync(run, token);
    }

    private async Task<IActionResult> DescribeAsync(ImportRun? run, CancellationToken token)
    {
        if (run is null) return NoContent();

        if (run.Status is ImportStatus.Queued or ImportStatus.Running)
        {
            return Ok(new
            {
                run.Id, status = run.Status.ToString(), run.Pages, run.Invoices, run.Error,
                run.From, run.Through, lastSuccessAt = (DateTimeOffset?)null,
                unlinkedPercent = (decimal?)null, unlinked = Array.Empty<object>()
            });
        }

        var last = await LastSuccessAsync(run.Source, token);
        var eligible = from line in db.Set<SaleLine>()
                       join sale in db.Set<Sale>() on line.SaleId equals sale.Id
                       where sale.Source == run.Source && sale.SaleDate >= run.From && sale.SaleDate <= run.Through
                             && (sale.Status == SaleStatus.Open || sale.Status == SaleStatus.Closed)
                             && line.Quantity > 0
                       select line;
        var total = await eligible.SumAsync(x => x.Quantity, token);
        var unlinked = await eligible.Where(x => x.ProductId == null).GroupBy(x => x.ExternalItemId)
            .Select(group => new { externalItemId = group.Key, units = group.Sum(x => x.Quantity) })
            .OrderByDescending(x => x.units).ThenBy(x => x.externalItemId).ToListAsync(token);

        return Ok(new
        {
            run.Id, status = run.Status.ToString(), run.Pages, run.Invoices, run.Error,
            run.From, run.Through, lastSuccessAt = last?.FinishedAt,
            unlinkedPercent = total == 0 ? (decimal?)null : 100 * unlinked.Sum(x => x.units) / total,
            unlinked
        });
    }

    private Task<ImportRun?> LastSuccessAsync(string source, CancellationToken token) =>
        SalesRuns().Where(x => x.Source == source && x.Status == ImportStatus.Succeeded)
            .OrderByDescending(x => x.FinishedAt).FirstOrDefaultAsync(token);

    private IQueryable<ImportRun> SalesRuns() =>
        db.Set<ImportRun>().AsNoTracking().Where(x => x.Kind == ImportKind.Sales);

    private Task<ImportRun?> ActiveAsync(CancellationToken token) =>
        db.Set<ImportRun>().AsNoTracking().SingleOrDefaultAsync(x => x.Active == true, token);

    private ConflictObjectResult AlreadyActive(ImportRun run) => run.Kind == ImportKind.Sales
        ? Conflict(new { id = run.Id, statusUrl = Url.Action(nameof(Get), new { id = run.Id }), message = "Ya hay una importación activa." })
        : Conflict(new { message = "Ya se está ejecutando una importación de contactos." });
}
