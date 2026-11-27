using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Domain.Common;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class CommercialRepurchaseRepository(MagicBeautyDbContext db) : ICommercialRepurchaseRepository
{
    public Task<ImportRun?> GetCompletedSalesAsync(Guid runId, CancellationToken cancellationToken) =>
        CompletedRuns().SingleOrDefaultAsync(run => run.Id == runId, cancellationToken);

    public async Task<IReadOnlyList<SalesCoverageWindow>> ReadCoverageAsync(string source, CancellationToken cancellationToken) =>
        await CompletedRuns().Where(run => run.Source == source)
            .Select(run => new SalesCoverageWindow(run.From, run.Through)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RepurchaseCandidate>> ReadCandidatesAsync(
        string source, int afterId, DateOnly start, DateOnly evaluatedAt, CancellationToken cancellationToken)
    {
        var accounts = await db.Users.AsNoTracking()
            .Where(user => user.Id > afterId && user.IsActive && user.EmailConfirmedAt != null &&
                user.CustomerId != null && user.Customer!.Source == source &&
                user.CommercialRole!.IsActive && user.CommercialRole.Code != RoleCodes.Retail && user.CommercialRole.RepurchaseDays > 0)
            .OrderBy(user => user.Id).Take(100)
            .Select(user => new
            {
                user.Id, RoleId = user.CommercialRoleId!.Value, user.RowVersion,
                CustomerId = user.CustomerId!.Value, user.Customer!.ExternalId, user.Customer.DocumentNumber,
                Days = user.CommercialRole!.RepurchaseDays!.Value,
                AssignmentId = db.CommercialRoleHistory.Where(entry => entry.UserId == user.Id && entry.NewRoleId == user.CommercialRoleId)
                    .OrderByDescending(entry => entry.Id).Select(entry => entry.Id).FirstOrDefault(),
                MarketingOptIn = db.PrivacyConsents.Where(consent => consent.UserId == user.Id).OrderByDescending(consent => consent.Id)
                    .Select(consent => consent.Accepted && consent.MarketingOptIn).FirstOrDefault()
            }).ToListAsync(cancellationToken);
        if (accounts.Count == 0) return [];

        var ids = accounts.Select(user => user.CustomerId).Distinct().ToArray();
        var sales = EligibleSales(source, evaluatedAt);
        var purchases = await sales.Where(sale => sale.CustomerId != null && ids.Contains(sale.CustomerId.Value))
            .GroupBy(sale => sale.CustomerId!.Value)
            .Select(group => new { CustomerId = group.Key, Last = group.Max(sale => sale.SaleDate) })
            .ToDictionaryAsync(group => group.CustomerId, group => (DateOnly?)group.Last, cancellationToken);
        var documents = accounts.Select(user => user.DocumentNumber).Distinct().ToArray();
        var keys = accounts.Select(user => user.ExternalId).Distinct().ToArray();
        var unresolved = await sales.Where(sale => sale.CustomerId == null && sale.SaleDate >= start &&
                (documents.Contains(sale.CustomerDocumentNumber) || keys.Contains(sale.CustomerExternalId)))
            .Select(sale => new { sale.CustomerDocumentNumber, sale.CustomerExternalId }).ToListAsync(cancellationToken);

        return accounts.Select(user => new RepurchaseCandidate(
            user.Id, user.RoleId, user.RowVersion, purchases.GetValueOrDefault(user.CustomerId), user.Days,
            user.AssignmentId, user.MarketingOptIn, unresolved.Any(sale =>
                sale.CustomerDocumentNumber == user.DocumentNumber ||
                string.Equals(sale.CustomerExternalId, user.ExternalId, StringComparison.OrdinalIgnoreCase)))).ToArray();
    }

    public async Task StageAsync(CommercialNotice notice, byte[] userVersion, DateTimeOffset now, CancellationToken cancellationToken)
    {
        await SalesImportLock.EnsureHeldAsync(db, cancellationToken);
        if (await db.CommercialNotices.AnyAsync(entry => entry.UserId == notice.UserId && entry.RoleId == notice.RoleId &&
            entry.AssignmentId == notice.AssignmentId && entry.PurchaseOn == notice.PurchaseOn && entry.Kind == notice.Kind,
            cancellationToken)) return;

        var user = await db.Users.Include(user => user.CommercialRole)
            .SingleOrDefaultAsync(user => user.Id == notice.UserId, cancellationToken);
        if (user is not { IsActive: true, CommercialRole.IsActive: true } || user.CommercialRoleId != notice.RoleId ||
            user.CommercialRole.RepurchaseDays != notice.DueOn.DayNumber - notice.PurchaseOn.DayNumber ||
            !user.RowVersion.AsSpan().SequenceEqual(userVersion))
        {
            db.ChangeTracker.Clear();
            return;
        }

        if (notice.Kind == CommercialNoticeKind.Expired)
        {
            var retail = await db.Roles.SingleOrDefaultAsync(role =>
                role.Code == RoleCodes.Retail && role.Kind == RoleKind.Commercial && role.IsActive, cancellationToken)
                ?? throw new InvalidOperationException("El rol Detal no está disponible.");
            user.AssignCommercialRole(retail);
            user.UpdatedAt = now.UtcDateTime;
            db.CommercialRoleHistory.Add(new CommercialRoleHistory
            {
                UserId = user.Id, PreviousRoleId = notice.RoleId, NewRoleId = retail.Id,
                Reason = CommercialRoleChangeReason.Expired, ChangedAt = now
            });
        }

        db.CommercialNotices.Add(notice);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Otra operación modificó la cuenta. La próxima importación leerá su estado nuevo.
        }
        finally
        {
            db.ChangeTracker.Clear();
        }
    }

    public async Task<IReadOnlyList<CommercialNotice>> GetPendingNoticesAsync(string source, CancellationToken cancellationToken) =>
        await db.CommercialNotices.AsNoTracking().Where(notice => notice.Source == source && notice.AttemptedAt == null)
            .OrderBy(notice => notice.Id).Take(100).ToListAsync(cancellationToken);

    public async Task<bool> TryClaimAsync(long id, DateTimeOffset now, CancellationToken cancellationToken) =>
        await db.CommercialNotices.Where(notice => notice.Id == id && notice.AttemptedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(notice => notice.AttemptedAt, now), cancellationToken) == 1;

    public async Task<string?> GetRecipientAsync(CommercialNotice notice, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking()
            .Where(user => user.Id == notice.UserId && user.IsActive && user.EmailConfirmedAt != null)
            .Select(user => new { user.Email, user.CommercialRoleId, user.CustomerId }).SingleOrDefaultAsync(cancellationToken);
        if (user is null) return null;
        if (notice.Kind == CommercialNoticeKind.Expired) return user.Email;
        if (user.CommercialRoleId != notice.RoleId || user.CustomerId is null ||
            !await db.PrivacyConsents.Where(consent => consent.UserId == notice.UserId).OrderByDescending(consent => consent.Id)
                .Select(consent => consent.Accepted && consent.MarketingOptIn).FirstOrDefaultAsync(cancellationToken) ||
            await EligibleSales(notice.Source, DateOnly.MaxValue).AnyAsync(sale =>
                sale.CustomerId == user.CustomerId && sale.SaleDate > notice.PurchaseOn, cancellationToken) ||
            await db.CommercialRoleHistory.AnyAsync(entry => entry.UserId == notice.UserId && entry.Id > notice.AssignmentId,
                cancellationToken)) return null;

        return user.Email;
    }

    public Task MarkSentAsync(long id, DateTimeOffset now, CancellationToken cancellationToken) =>
        db.CommercialNotices.Where(notice => notice.Id == id)
            .ExecuteUpdateAsync(update => update.SetProperty(notice => notice.SentAt, now), cancellationToken);

    private IQueryable<ImportRun> CompletedRuns() => db.Set<ImportRun>().AsNoTracking().Where(run =>
        run.Kind == ImportKind.Sales && run.Status == ImportStatus.Succeeded && run.AllPagesRead && run.CapturesCustomerEvidence);

    private IQueryable<Sale> EligibleSales(string source, DateOnly through) =>
        db.Sales.AsNoTracking().Where(sale => sale.Source == source && sale.SaleDate <= through &&
            (sale.Status == SaleStatus.Open || sale.Status == SaleStatus.Closed));

}
