using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Customers;

public sealed record SalesCoverageWindow(DateOnly From, DateOnly Through);

public sealed record CommercialRepurchaseDecision(CommercialNoticeKind Kind, DateOnly DueOn);

public static class CommercialRepurchasePolicy
{
    /// <summary>Calcula cuántos días hacia atrás están cubiertos sin huecos hasta la evaluación.</summary>
    public static DateOnly? GetCoverageStart(
        DateOnly evaluatedAt, DateOnly runThrough, IReadOnlyList<SalesCoverageWindow> windows)
    {
        if (runThrough < evaluatedAt) return null;

        DateOnly? start = null;
        foreach (var window in windows.Where(window => window.From <= window.Through)
                     .OrderByDescending(window => window.Through))
        {
            if (window.From > evaluatedAt) continue;
            if (start is null && window.Through < evaluatedAt) return null;
            if (start is { } covered && window.Through.DayNumber < covered.DayNumber - 1) break;
            if (start is null || window.From < start) start = window.From;
        }

        return start;
    }

    /// <summary>Solo decide si se conocen la compra y todo el intervalo de recompra.</summary>
    public static CommercialRepurchaseDecision? Decide(
        DateOnly? lastPurchase, int? repurchaseDays, DateOnly evaluatedAt, DateOnly? coverageStart,
        int reminderDays, bool marketingOptIn)
    {
        if (lastPurchase is not { } purchase || purchase > evaluatedAt || repurchaseDays is not > 0 ||
            coverageStart is not { } start || start.DayNumber > purchase.DayNumber + 1)
            return null;

        var dueNumber = purchase.DayNumber + (long)repurchaseDays.Value;
        if (dueNumber > DateOnly.MaxValue.DayNumber) return null;
        var dueOn = DateOnly.FromDayNumber((int)dueNumber);
        if (evaluatedAt > dueOn)
            return new CommercialRepurchaseDecision(CommercialNoticeKind.Expired, dueOn);
        if (marketingOptIn && reminderDays > 0 && dueOn.DayNumber - evaluatedAt.DayNumber <= reminderDays)
            return new CommercialRepurchaseDecision(CommercialNoticeKind.Reminder, dueOn);

        return null;
    }
}
