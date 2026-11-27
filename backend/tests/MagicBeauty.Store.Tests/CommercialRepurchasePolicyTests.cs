using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Domain.Entities;
using Xunit;

public sealed class CommercialRepurchasePolicyTests
{
    private static readonly DateOnly Purchase = new(2026, 11, 1);
    private static readonly DateOnly Due = new(2026, 12, 1);
    private static readonly DateOnly Evaluation = new(2026, 12, 2);

    [Fact]
    public void ExpirationRequiresTheCurrentImportToCoverTheEvaluationDate()
    {
        SalesCoverageWindow[] windows = [new(Purchase, Evaluation)];

        var coverage = CommercialRepurchasePolicy.GetCoverageStart(Evaluation, Evaluation.AddDays(-1), windows);

        Assert.Null(coverage);
        Assert.Null(CommercialRepurchasePolicy.Decide(Purchase, 30, Evaluation, coverage, 5, true));
    }

    [Fact]
    public void CoverageMustActuallyReachTheEvaluationDate()
    {
        SalesCoverageWindow[] windows = [new(Purchase, Evaluation.AddDays(-1))];

        Assert.Null(CommercialRepurchasePolicy.GetCoverageStart(Evaluation, Evaluation, windows));
        Assert.Null(CommercialRepurchasePolicy.GetCoverageStart(Evaluation, Evaluation, []));
    }

    [Fact]
    public void OverlappingAndAdjacentImportsProvideContinuousCoverage()
    {
        SalesCoverageWindow[] windows =
        [
            new(Purchase.AddDays(18), Purchase.AddDays(23)),
            new(Purchase.AddDays(1), Purchase.AddDays(17)),
            new(Purchase.AddDays(22), Evaluation)
        ];

        var coverage = CommercialRepurchasePolicy.GetCoverageStart(Evaluation, Evaluation, windows);

        Assert.Equal(Purchase.AddDays(1), coverage);
        var decision = CommercialRepurchasePolicy.Decide(Purchase, 30, Evaluation, coverage, 5, false);
        Assert.Equal(new CommercialRepurchaseDecision(CommercialNoticeKind.Expired, Due), decision);
    }

    [Fact]
    public void GapInImportsPreventsAssumingTheCustomerDidNotRepurchase()
    {
        var recentStart = Purchase.AddDays(15);
        SalesCoverageWindow[] windows =
        [
            new(Purchase, recentStart.AddDays(-2)),
            new(recentStart, Evaluation)
        ];

        var coverage = CommercialRepurchasePolicy.GetCoverageStart(Evaluation, Evaluation, windows);

        Assert.Equal(recentStart, coverage);
        Assert.Null(CommercialRepurchasePolicy.Decide(Purchase, 30, Evaluation, coverage, 5, true));
    }

    [Theory]
    [InlineData(-6, 5, true, null)]
    [InlineData(-5, 5, true, CommercialNoticeKind.Reminder)]
    [InlineData(-5, 5, false, null)]
    [InlineData(-1, 0, true, null)]
    [InlineData(0, 5, true, CommercialNoticeKind.Reminder)]
    [InlineData(0, 5, false, null)]
    [InlineData(1, 5, false, CommercialNoticeKind.Expired)]
    public void ReminderRespectsTheWindowAndConsentWithoutChangingExpiration(
        int daysFromDue, int reminderDays, bool marketingOptIn, CommercialNoticeKind? expectedKind)
    {
        var result = CommercialRepurchasePolicy.Decide(Purchase, 30, Due.AddDays(daysFromDue),
            Purchase, reminderDays, marketingOptIn);

        Assert.Equal(expectedKind, result?.Kind);
        if (expectedKind is not null)
        {
            Assert.Equal(Due, result!.DueOn);
        }
    }

    [Fact]
    public void NoPurchaseOrNoRoleDeadlineMeansNoDecision()
    {
        Assert.Null(CommercialRepurchasePolicy.Decide(null, 30, Evaluation, Purchase, 5, true));
        Assert.Null(CommercialRepurchasePolicy.Decide(Purchase, null, Evaluation, Purchase, 5, true));
    }

    [Fact]
    public void ARepurchaseMovesTheDeadlineToDaysAfterTheNewInvoice()
    {
        var newerPurchase = new DateOnly(2026, 11, 6);

        var before = CommercialRepurchasePolicy.Decide(Purchase, 30, Evaluation, Purchase, 5, true);
        var after = CommercialRepurchasePolicy.Decide(newerPurchase, 30, Evaluation, Purchase, 5, true);

        Assert.Equal(new CommercialRepurchaseDecision(CommercialNoticeKind.Expired, Due), before);
        Assert.Equal(new CommercialRepurchaseDecision(CommercialNoticeKind.Reminder, new DateOnly(2026, 12, 6)), after);
    }
}
