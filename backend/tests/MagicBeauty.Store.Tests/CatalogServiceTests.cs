using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Application.Features.Pricing;
using MagicBeauty.Store.Domain.Entities;
using Moq;
using Xunit;

public sealed class CatalogServiceTests
{
    [Fact]
    public async Task PublicListIncludesCategoryIdsAndOnlyVisiblePrices()
    {
        var retail = new PriceType { Id = 1, Code = "RETAIL", Name = "Detal" };
        var distributor = new PriceType { Id = 3, Code = "DISTRIBUTOR", Name = "Distribuidor" };
        var product = new Product
        {
            Id = 7,
            Reference = "ACO011",
            Name = "Labial",
            IsActive = true,
            ProductCategories = [new ProductCategory { CategoryId = 4 }, new ProductCategory { CategoryId = 9 }],
            Prices =
            [
                new ProductPrice { PriceTypeId = 1, Amount = 25000, IsActive = true },
                new ProductPrice { PriceTypeId = 3, Amount = 15000, IsActive = true }
            ]
        };

        var products = new Mock<IProductRepository>();
        products
            .Setup(repository => repository.GetAllAsync(null, null, true, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([product]);

        // La politica solo autoriza Detal: Distribuidor no debe salir aunque el producto lo tenga.
        var policy = new Mock<IPriceVisibilityPolicy>();
        policy
            .Setup(item => item.GetVisiblePriceTypesAsync(It.IsAny<PriceAudience>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([retail]);

        var audience = new Mock<IPriceAudienceProvider>();
        audience.Setup(item => item.GetCurrent()).Returns(PriceAudience.Anonymous);

        var service = new CatalogService(products.Object, policy.Object, audience.Object);

        var item = Assert.Single(await service.GetProductsAsync(null, null, null, default));

        Assert.Equal([4, 9], item.CategoryIds);
        Assert.Equal(["RETAIL"], item.Prices.Select(price => price.PriceTypeCode).ToArray());
        Assert.DoesNotContain(item.Prices, price => price.PriceTypeCode == distributor.Code);
    }
}
