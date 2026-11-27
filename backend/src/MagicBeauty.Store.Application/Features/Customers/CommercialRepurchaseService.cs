using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Application.Features.Customers;

public sealed class CommercialRepurchaseService(
    ICommercialRepurchaseRepository repository, IEmailSender mail, TimeProvider clock,
    ILogger<CommercialRepurchaseService> logger)
{
    /// <summary>Se ejecuta al finalizar ventas y solo cuando la evidencia cubre el ciclo completo.</summary>
    public async Task<string?> EvaluateAsync(Guid runId, DateOnly evaluatedAt, int reminderDays, CancellationToken cancellationToken)
    {
        var run = await repository.GetCompletedSalesAsync(runId, cancellationToken);
        if (run is null || run.Through < evaluatedAt) return null;

        var coverage = await repository.ReadCoverageAsync(run.Source, cancellationToken);
        var start = CommercialRepurchasePolicy.GetCoverageStart(evaluatedAt, run.Through, coverage);
        if (start is not { } coveredFrom) return null;

        var afterId = 0;
        while (true)
        {
            var candidates = await repository.ReadCandidatesAsync(run.Source, afterId, coveredFrom, evaluatedAt, cancellationToken);
            if (candidates.Count == 0) break;
            foreach (var candidate in candidates)
            {
                if (candidate.HasUnresolvedPurchases) continue;
                var decision = CommercialRepurchasePolicy.Decide(candidate.LastPurchase, candidate.Days, evaluatedAt,
                    coveredFrom, reminderDays, candidate.MarketingOptIn);
                if (decision is null) continue;

                await repository.StageAsync(new CommercialNotice
                {
                    UserId = candidate.UserId, RoleId = candidate.RoleId, Source = run.Source,
                    AssignmentId = candidate.AssignmentId, PurchaseOn = candidate.LastPurchase!.Value,
                    DueOn = decision.DueOn, Kind = decision.Kind
                }, candidate.RowVersion, clock.GetUtcNow(), cancellationToken);
            }
            afterId = candidates[^1].UserId;
        }

        return run.Source;
    }

    public async Task SendPendingAsync(string source, CancellationToken cancellationToken)
    {
        while (true)
        {
            var notices = await repository.GetPendingNoticesAsync(source, cancellationToken);
            if (notices.Count == 0) return;

            foreach (var notice in notices)
            {
                var recipient = await repository.GetRecipientAsync(notice, cancellationToken);
                if (!await repository.TryClaimAsync(notice.Id, clock.GetUtcNow(), cancellationToken) || recipient is null)
                    continue;

                var expired = notice.Kind == CommercialNoticeKind.Expired;
                try
                {
                    await mail.SendAsync(recipient,
                        expired ? "Venció tu condición comercial" : "Tu condición comercial vence pronto",
                        expired ? "Tu condición comercial venció y tu cuenta volvió a Detal."
                            : $"Tu condición comercial vence el {notice.DueOn:dd/MM/yyyy}. Puedes conservarla con una nueva compra.",
                        cancellationToken);
                    await repository.MarkSentAsync(notice.Id, clock.GetUtcNow(), cancellationToken);
                }
                catch (Exception failure) when (!cancellationToken.IsCancellationRequested)
                {
                    // SMTP puede haber aceptado el mensaje antes de fallar. No se duplica el intento del ciclo.
                    logger.LogWarning("No se confirmó la entrega del aviso comercial {NoticeId} ({ErrorType}).",
                        notice.Id, failure.GetType().Name);
                }
            }
        }
    }
}
