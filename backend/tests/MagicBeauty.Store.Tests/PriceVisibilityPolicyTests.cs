using MagicBeauty.Store.Application.Features.Pricing;
using MagicBeauty.Store.Application.Features.Accounts;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Infrastructure.Services;
using MagicBeauty.Store.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

public sealed class PriceVisibilityPolicyTests
{
    [Theory]
    [InlineData(null, "RETAIL,WHOLESALE")]
    [InlineData("", "RETAIL,WHOLESALE")]
    [InlineData("CUSTOMER_RETAIL", "RETAIL,WHOLESALE")]
    [InlineData("CUSTOMER_WHOLESALE", "WHOLESALE")]
    [InlineData("CUSTOMER_DISTRIBUTOR", "DISTRIBUTOR")]
    [InlineData("ADMIN", "RETAIL,WHOLESALE,DISTRIBUTOR,NEW_PRIVATE")]
    public async Task ResolvesPricesByAudience(string? role, string expected)
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new MagicBeautyDbContext(options);
        await db.Database.EnsureCreatedAsync();
        db.PriceTypes.AddRange(
            new PriceType { Id = 100, Code = "NEW_PRIVATE", Name = "Nuevo", DisplayOrder = 100, IsActive = true },
            new PriceType { Id = 101, Code = "INACTIVE", Name = "Inactivo", DisplayOrder = 101, IsActive = false });
        await db.SaveChangesAsync();
        var policy = new PriceVisibilityPolicy(new PriceTypeRepository(db));
        var audience = role is null
            ? PriceAudience.Anonymous
            : PriceAudience.Authenticated(role.Length == 0 ? [] : [role]);

        var prices = await policy.GetVisiblePriceTypesAsync(audience, default);

        Assert.Equal(expected.Split(','), prices.Select(price => price.Code));
    }

    [Fact]
    public async Task CommercialRoleReplacesPriorRoleAndPreservesInternalAccess()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new MagicBeautyDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var roles = await db.Roles.ToDictionaryAsync(role => role.Code);
        var user = new User { Email = "cliente@example.invalid", EmailConfirmedAt = DateTime.UtcNow };
        var admin = roles["ADMIN"];
        user.UserRoles.Add(new UserRole { Role = admin, RoleId = admin.Id });
        user.AssignCommercialRole(roles["CUSTOMER_RETAIL"]);
        var priorStamp = user.SecurityStamp;
        user.AssignCommercialRole(roles["CUSTOMER_WHOLESALE"]);
        Assert.Throws<InvalidOperationException>(() => user.AssignCommercialRole(admin));
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var accounts = new AccountService(new UserRepository(db), new IdentityPasswordHasher(), Mock.Of<IEmailSender>());
        var session = await accounts.GetSessionAccountAsync(user.Id, default);

        Assert.NotNull(session);
        Assert.NotEqual(priorStamp, session.SecurityStamp);
        Assert.Equal(new[] { "ADMIN", "CUSTOMER_WHOLESALE" }, session.RoleCodes);
    }
}
