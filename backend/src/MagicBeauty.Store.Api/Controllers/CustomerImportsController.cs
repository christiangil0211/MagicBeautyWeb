using MagicBeauty.Store.Api.Sales;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Contracts.Customers.Responses;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/admin/customers/imports")]
public sealed class CustomerImportsController(
    MagicBeautyDbContext db, IEnumerable<ICustomerImportSource> sources, SalesImportQueue queue, TimeProvider clock) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Start(CancellationToken cancellationToken)
    {
        if (!queue.Ready.IsCompletedSuccessfully)
            return StatusCode(503, new { message = "La importación de contactos no está disponible." });

        if (await db.Set<ImportRun>().AnyAsync(run => run.Active == true, cancellationToken))
            return AlreadyActive();

        var source = sources.SingleOrDefault(source => source.IsEnabled);
        if (source is null)
            return StatusCode(503, new { message = "No hay una fuente de contactos habilitada." });

        var today = SalesCalendar.Today(clock);
        var run = new ImportRun
        {
            Id = Guid.NewGuid(), Source = source.Source, Kind = ImportKind.Customers,
            From = today, Through = today, StartedAt = clock.GetUtcNow(),
            Active = true, Status = ImportStatus.Queued
        };
        db.Add(run);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return AlreadyActive();
        }

        queue.Enqueue(run.Id);
        return AcceptedAtAction(nameof(Get), new { id = run.Id }, new { id = run.Id });
    }

    [HttpGet("latest")]
    public async Task<ActionResult<CustomerImportRunDto>> Latest(CancellationToken cancellationToken)
    {
        var run = await CustomerRuns().OrderByDescending(run => run.Active).ThenByDescending(run => run.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return run is null ? NoContent() : Ok(Describe(run));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerImportRunDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var run = await CustomerRuns().SingleOrDefaultAsync(run => run.Id == id, cancellationToken);

        return run is null ? NotFound() : Ok(Describe(run));
    }

    private IQueryable<ImportRun> CustomerRuns() =>
        db.Set<ImportRun>().AsNoTracking().Where(run => run.Kind == ImportKind.Customers);

    private static CustomerImportRunDto Describe(ImportRun run) =>
        new(run.Id, run.Status.ToString(), run.Pages, run.Contacts, run.SkippedContacts, run.Error);

    private ConflictObjectResult AlreadyActive() => Conflict(new { message = "Ya hay una importación activa." });
}
