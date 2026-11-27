using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Contracts.Customers.Requests;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

public sealed class CustomerAdministrationTests
{
    [Fact]
    public async Task ApprovalChecksVersionsSwitchesCommercialRoleAndAuditsTheActor()
    {
        await using var db = await OpenAsync();
        var request = await db.RoleRequests.Include(entry => entry.User).SingleAsync();
        var user = request.User!;
        var initialStamp = user.SecurityStamp;
        var service = new CustomerAdministration(new CustomerAdministrationRepository(db), TimeProvider.System);
        var decision = new ReviewRoleRequest { Approve = true, Note = "Compras revisadas.", RowVersion = [1], UserRowVersion = [9] };

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ReviewAsync(request.Id, decision, 2, default));
        Assert.Equal(RoleRequestStatus.Pending, request.Status);
        decision.UserRowVersion = [2];
        await service.ReviewAsync(request.Id, decision, 2, default);

        Assert.Equal(RoleRequestStatus.Approved, request.Status);
        Assert.Equal(3, user.CommercialRoleId);
        Assert.NotEqual(initialStamp, user.SecurityStamp);
        var audit = await db.CommercialRoleHistory.SingleAsync();
        Assert.Equal((2, 3, 2), (audit.PreviousRoleId, audit.NewRoleId, audit.ActorUserId));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ReviewAsync(request.Id, decision, 2, default));
    }

    [Fact]
    public async Task PurchaseEvidenceOnlyCountsInvoicesForTheLinkedCustomer()
    {
        await using var db = await OpenAsync();
        var repo = new CustomerAdministrationRepository(db);

        var list = await repo.GetRequestsAsync(1, 10, default);

        var request = Assert.Single(list.Items);
        Assert.Equal(2, request.InvoiceCount);
        Assert.Equal(30, request.Total);
        Assert.Equal(new DateOnly(2026, 11, 10), request.LastPurchaseAt);
    }

    [Fact]
    public async Task CannotAssignInternalRoleAndDisablingACustomerRotatesTheStamp()
    {
        await using var db = await OpenAsync();
        var service = new CustomerAdministration(new CustomerAdministrationRepository(db), TimeProvider.System);
        var user = await db.Users.SingleAsync(user => user.Id == 1);
        var stamp = user.SecurityStamp;
        await Assert.ThrowsAsync<ArgumentException>(() => service.ChangeRoleAsync(1,
            new ChangeCustomerRoleRequest { RoleCode = "ADMIN", RowVersion = [2] }, 2, default));

        await service.ChangeActiveAsync(1, new ChangeCustomerActiveRequest { IsActive = false, RowVersion = [2] }, 2, default);
        Assert.False(user.IsActive);
        Assert.NotEqual(stamp, user.SecurityStamp);
    }

    private static async Task<MagicBeautyDbContext> OpenAsync()
    {
        var db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        await db.Database.EnsureCreatedAsync();
        var roles = await db.Roles.ToDictionaryAsync(role => role.Id);
        var user = new User { Id = 1, Email = "customer@example.invalid", City = "Cali", RowVersion = [2] };
        user.AssignCommercialRole(roles[2]);
        db.Users.AddRange(user, new User { Id = 2, Email = "operator@example.invalid" });
        var customer = new Customer { Id = 1, Source = "test", ExternalId = "c1", DocumentNumber = "123", Name = "Cliente" };
        user.Customer = customer;
        db.Customers.Add(customer);
        db.RoleRequests.Add(new RoleRequest
        {
            Id = 1, User = user, RequestedRole = roles[3], DocumentNumber = "123", RowVersion = [1]
        });
        db.Sales.AddRange(
            Sale("open", 1, SaleStatus.Open, 10, 10), Sale("closed", 1, SaleStatus.Closed, 20, 5),
            Sale("voided", 1, SaleStatus.Voided, 900, 15), Sale("unlinked", null, SaleStatus.Open, 200, 16));
        await db.SaveChangesAsync();
        return db;
    }

    private static Sale Sale(string id, long? customer, SaleStatus status, decimal total, int day) =>
        new() { Source = "test", ExternalId = id, CustomerId = customer, Status = status, Total = total, SaleDate = new DateOnly(2026, 11, day) };
}
