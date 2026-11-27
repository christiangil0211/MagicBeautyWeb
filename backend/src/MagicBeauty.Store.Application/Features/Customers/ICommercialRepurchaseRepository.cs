using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Customers;

public sealed record RepurchaseCandidate(
    int UserId, int RoleId, byte[] RowVersion, DateOnly? LastPurchase, int Days,
    long AssignmentId, bool MarketingOptIn, bool HasUnresolvedPurchases);

public interface ICommercialRepurchaseRepository
{
    Task<ImportRun?> GetCompletedSalesAsync(Guid runId, CancellationToken cancellationToken);
    Task<IReadOnlyList<SalesCoverageWindow>> ReadCoverageAsync(string source, CancellationToken cancellationToken);
    Task<IReadOnlyList<RepurchaseCandidate>> ReadCandidatesAsync(
        string source, int afterId, DateOnly start, DateOnly evaluatedAt, CancellationToken cancellationToken);
    Task StageAsync(CommercialNotice notice, byte[] userVersion, DateTimeOffset now, CancellationToken cancellationToken);
    Task<IReadOnlyList<CommercialNotice>> GetPendingNoticesAsync(string source, CancellationToken cancellationToken);
    Task<bool> TryClaimAsync(long id, DateTimeOffset now, CancellationToken cancellationToken);
    Task<string?> GetRecipientAsync(CommercialNotice notice, CancellationToken cancellationToken);
    Task MarkSentAsync(long id, DateTimeOffset now, CancellationToken cancellationToken);
}
