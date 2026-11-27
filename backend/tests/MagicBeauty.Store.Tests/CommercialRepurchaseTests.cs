using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

public sealed class CommercialRepurchaseTests
{
    [Theory]
    [InlineData(31, false, CommercialNoticeKind.Expired)]
    [InlineData(27, true, CommercialNoticeKind.Reminder)]
    [InlineData(27, false, null)]
    public async Task EvaluatesOnlyCoveredSalesAndStagesAtMostOnce(int purchaseAge, bool marketing, CommercialNoticeKind? expected)
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new MagicBeautyDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var today = new DateOnly(2026, 11, 27);
        var customer = new Customer { Source = "test", ExternalId = "c", DocumentNumber = "123", Name = "Cliente" };
        var user = new User { Email = "cliente@example.invalid", Customer = customer, EmailConfirmedAt = DateTime.UtcNow };
        user.AssignCommercialRole(await db.Roles.SingleAsync(role => role.Id == 3));
        var originalStamp = user.SecurityStamp;
        db.Users.Add(user);
        db.PrivacyConsents.Add(new PrivacyConsent { User = user, Accepted = true, PolicyVersion = "1.0", MarketingOptIn = marketing });
        db.Sales.Add(new Sale { Source = "test", ExternalId = "invoice", Customer = customer, Status = SaleStatus.Closed, SaleDate = today.AddDays(-purchaseAge) });
        var stale = Run(today.AddDays(-45), today.AddDays(-1));
        var current = Run(today.AddDays(-45), today);
        db.AddRange(stale, current);
        await db.SaveChangesAsync();
        var sender = new Mock<IEmailSender>(MockBehavior.Strict);
        var service = new CommercialRepurchaseService(new CommercialRepurchaseRepository(db), sender.Object,
            TimeProvider.System, NullLogger<CommercialRepurchaseService>.Instance);

        Assert.Null(await service.EvaluateAsync(stale.Id, today, 5, default));
        Assert.Empty(db.CommercialNotices);
        Assert.Equal("test", await service.EvaluateAsync(current.Id, today, 5, default));
        Assert.Equal("test", await service.EvaluateAsync(current.Id, today, 5, default));

        if (expected is null)
            Assert.Empty(db.CommercialNotices);
        else
            Assert.Equal(expected, (await db.CommercialNotices.SingleAsync()).Kind);
        var finalUser = await db.Users.SingleAsync();
        if (expected == CommercialNoticeKind.Expired)
        {
            Assert.Equal(2, finalUser.CommercialRoleId);
            Assert.NotEqual(originalStamp, finalUser.SecurityStamp);
            Assert.Equal(CommercialRoleChangeReason.Expired, (await db.CommercialRoleHistory.SingleAsync()).Reason);
        }
        else
        {
            Assert.Equal(3, finalUser.CommercialRoleId);
            Assert.Equal(originalStamp, finalUser.SecurityStamp);
            Assert.Empty(db.CommercialRoleHistory);
        }

        sender.VerifyNoOtherCalls();
    }

    private static ImportRun Run(DateOnly from, DateOnly through) => new()
    {
        Id = Guid.NewGuid(), Source = "test", From = from, Through = through, Status = ImportStatus.Succeeded,
        Kind = ImportKind.Sales, AllPagesRead = true, CapturesCustomerEvidence = true
    };
}
