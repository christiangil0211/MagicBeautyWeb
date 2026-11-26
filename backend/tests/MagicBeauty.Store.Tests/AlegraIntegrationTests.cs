using System.Net;
using System.Text;
using System.Text.Json;

using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Brands;
using MagicBeauty.Store.Application.Features.PriceTypes;
using MagicBeauty.Store.Application.Features.Products;
using MagicBeauty.Store.Contracts.Products.Requests;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Domain.Enums;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Integrations.Alegra;
using MagicBeauty.Store.Integrations.Alegra.Client;
using MagicBeauty.Store.Integrations.Alegra.Persistence;
using MagicBeauty.Store.Integrations.Alegra.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

/// <summary>Integracion con Alegra: actualizacion bajo demanda de productos.</summary>
public sealed class AlegraIntegrationTests : IDisposable
{
    private const int Retail = 1;
    private const int Wholesale = 2;
    private static readonly DateTime SeededAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private readonly MagicBeautyDbContext db;
    private readonly AlegraDbContext linksDb;
    private Mock<IProductService> products = null!;

    public AlegraIntegrationTests()
    {
        db = CreateStoreDatabase();
        linksDb = new AlegraDbContext(new DbContextOptionsBuilder<AlegraDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    }

    public void Dispose()
    {
        db.Dispose();
        linksDb.Dispose();
    }

    // ----- Cruce por id de Alegra -----

    [Fact]
    public async Task LinksExistingProductsByReferenceTheFirstTimeAndThenByAlegraId()
    {
        var first = await SyncAsync(Item("501", "ACO011", "Labial rojo", 20000m, 10));

        Assert.Equal((1, 0, 1), (first.Linked, first.Created, first.Unchanged));
        Assert.Equal(("501", 1), await LinkAsync(1));

        // En Alegra le cambiaron la referencia: sigue siendo el mismo producto por su id.
        var second = await SyncAsync(Item("501", "XYZ999", "Labial rojo intenso", 20000m, 10));
        db.ChangeTracker.Clear();

        Assert.Equal((0, 0, 1), (second.Linked, second.Created, second.Updated));
        Assert.Equal("Labial rojo intenso", (await LoadAsync("ACO011")).Name);
        Assert.False(await db.Products.AnyAsync(product => product.Reference == "XYZ999"));
    }

    [Fact]
    public async Task DoesNotLinkTwoAlegraItemsToTheSameProduct()
    {
        var result = await SyncAsync(
            Item("501", "ACO011", "Labial rojo", 20000m, 10),
            Item("502", "aco011", "Copia con la misma referencia", 1m, 1));

        Assert.Equal((1, 1), (result.Linked, result.Skipped));
        Assert.Contains("id 501", result.Issues.Single().Message);
        Assert.Equal("Labial rojo", (await LoadAsync("ACO011")).Name);
    }

    [Fact]
    public async Task ForgetsTheLinkOfADeletedProductAndCreatesItAgain()
    {
        linksDb.ProductLinks.Add(new AlegraProductLink { ProductId = 999, AlegraItemId = "777", LinkedAt = SeededAt, LastSyncedAt = SeededAt });
        await linksDb.SaveChangesAsync();

        var result = await SyncAsync(Item("777", "NEW001", "Volvió a Alegra", 1000m, 1));

        Assert.Equal(1, result.Created);
        var product = await LoadAsync("NEW001");
        Assert.Equal(("777", product.Id), await LinkAsync(product.Id));
        Assert.False(await linksDb.ProductLinks.AnyAsync(link => link.ProductId == 999));
    }

    [Fact]
    public async Task SkipsItemsWithoutIdOrWithoutAUsableReference()
    {
        var result = await SyncAsync(
            Item(null, "NEW001", "Sin id", 1000m, 1),
            Item("601", null, "Sin referencia", 1000m, 1),
            Item("602", "12345", "Formato de Alegra", 1000m, 1),
            Item("603", "NEW002", "Válido", 1000m, 1),
            Item("603", "NEW002", "Repetido", 1000m, 1));

        Assert.Equal((5, 1, 4), (result.Total, result.Created, result.Skipped));
        Assert.All(result.Issues, issue => Assert.Equal(AlegraSyncIssue.Skipped, issue.Kind));
        Assert.Equal("Válido", (await LoadAsync("NEW002")).Name);
    }

    // ----- Datos que se actualizan -----

    [Fact]
    public async Task UpdatesNameDescriptionStatusPriceAndStockOfAnExistingProduct()
    {
        var result = await SyncAsync(Item("501", "ACO011", "Labial mate rojo", 25000m, 7, description: "Larga duración", status: "inactive"));
        db.ChangeTracker.Clear();

        Assert.Equal((1, 1, 0, 0, 0), (result.Total, result.Updated, result.Created, result.Skipped, result.Failed));
        var product = await LoadAsync("ACO011");
        Assert.Equal("Labial mate rojo", product.Name);
        Assert.Equal("Larga duración", product.Description);
        Assert.False(product.IsActive);
        // Solo cambia el tipo de precio configurado; el mayorista se conserva.
        Assert.Equal(25000m, product.Prices.Single(price => price.PriceTypeId == Retail).Amount);
        Assert.Equal(15000m, product.Prices.Single(price => price.PriceTypeId == Wholesale).Amount);
        // El inventario queda igual a Alegra y deja un ajuste trazable.
        var variant = product.Variants.Single();
        Assert.Equal(7, variant.Quantity);
        var movement = await db.InventoryMovements.SingleAsync(item => item.ProductVariantId == variant.Id);
        Assert.Equal((InventoryMovementType.Adjustment, -3, 10, 7), (movement.Type, movement.Quantity, movement.PreviousQuantity, movement.NewQuantity));
        Assert.Equal("Sincronización con Alegra", movement.Reason);
    }

    [Fact]
    public async Task CreatesMissingProductsInactiveWithoutBrandStockPriceAndLink()
    {
        var result = await SyncAsync(Item("700", "NEW001", "Base líquida", 42000m, 5));
        db.ChangeTracker.Clear();

        Assert.Equal(1, result.Created);
        var product = await LoadAsync("NEW001");
        Assert.False(product.IsActive);
        // La marca la decide solo la tienda: el producto nace sin marca.
        Assert.Null(product.BrandId);
        Assert.False(product.HasVariants);
        Assert.Equal(5, product.Variants.Single().Quantity);
        Assert.Equal(42000m, product.Prices.Single().Amount);
        Assert.Equal(("700", product.Id), await LinkAsync(product.Id));
    }

    [Fact]
    public async Task NeverCreatesOrChangesBrands()
    {
        var brandsBefore = await db.Brands.CountAsync();

        await SyncAsync(
            Item("701", "NEW001", "Uno", 1000m, 1),
            Item("702", "NEW002", "Dos", 1000m, 1),
            Item("500", "ACO011", "Labial rojo renombrado", 1000m, 1));
        db.ChangeTracker.Clear();

        Assert.Equal(brandsBefore, await db.Brands.CountAsync());
        Assert.False(await db.Brands.AnyAsync(brand => brand.Name == "Sin marca"));
        Assert.Equal(1, (await LoadAsync("ACO011")).BrandId);
    }

    [Fact]
    public async Task DoesNotTouchTheStockOfProductsWithShadesAndWarnsAboutIt()
    {
        var result = await SyncAsync(Item("502", "TON001", "Paleta de tonos", 30000m, 99));
        db.ChangeTracker.Clear();

        Assert.Equal(1, result.Updated);
        Assert.Contains(result.Issues, issue => issue.Kind == AlegraSyncIssue.Warning && issue.Reference == "TON001");
        Assert.Equal(new[] { 4, 6 }, (await LoadAsync("TON001")).Variants.Select(variant => variant.Quantity).Order());
    }

    [Fact]
    public async Task UsesTheConfiguredPriceListAndPriceType()
    {
        var item = Item("501", "ACO011", "Labial rojo", 20000m, 10);
        item.Price.Add(new AlegraItemPrice { IdPriceList = "2", Price = 13000m });

        await SyncAsync(new AlegraOptions { PriceListId = 2, PriceTypeCode = "mayorista" }, item);
        db.ChangeTracker.Clear();

        var prices = (await LoadAsync("ACO011")).Prices;
        Assert.Equal(13000m, prices.Single(price => price.PriceTypeId == Wholesale).Amount);
        Assert.Equal(20000m, prices.Single(price => price.PriceTypeId == Retail).Amount);
    }

    [Fact]
    public async Task ItemsWithoutInventoryKeepTheStoreStock()
    {
        var item = Item("501", "ACO011", "Labial rojo", 20000m, 0);
        item.Inventory = null;

        var result = await SyncAsync(item);

        Assert.Equal(1, result.Unchanged);
        Assert.Equal(10, (await LoadAsync("ACO011")).Variants.Single().Quantity);
    }

    // ----- Velocidad: el detalle solo se carga si algo difiere -----

    [Fact]
    public async Task DoesNotLoadTheDetailOfProductsThatDidNotChange()
    {
        var before = (await LoadAsync("ACO011")).UpdatedAt;

        var result = await SyncAsync(Item("501", "aco011", "Labial rojo", 20000m, 10));

        Assert.Equal(1, result.Unchanged);
        products.Verify(service => service.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal(before, (await LoadAsync("ACO011")).UpdatedAt);
        Assert.Empty(await db.InventoryMovements.ToListAsync());
    }

    [Fact]
    public async Task ReloadsTheDetailOnlyWhenTheAlegraDescriptionChanges()
    {
        await SyncAsync(Item("501", "ACO011", "Labial rojo", 20000m, 10, description: "Primera"));
        await SyncAsync(Item("501", "ACO011", "Labial rojo", 20000m, 10, description: "Primera"));
        products.Verify(service => service.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);

        var result = await SyncAsync(Item("501", "ACO011", "Labial rojo", 20000m, 10, description: "Segunda"));
        db.ChangeTracker.Clear();

        Assert.Equal(1, result.Updated);
        Assert.Equal("Segunda", (await LoadAsync("ACO011")).Description);
    }

    // ----- Concurrencia y cliente HTTP -----

    [Fact]
    public async Task DoesNotRunTwoUpdatesAtTheSameTime()
    {
        var syncLock = new AlegraSyncLock();
        await syncLock.Semaphore.WaitAsync();

        await Assert.ThrowsAsync<AlegraSyncInProgressException>(() => Service(new AlegraOptions(), syncLock).SyncAsync(default));
    }

    [Fact]
    public void ReadsTheShapesAlegraUsesForIdsReferencesAndAmounts()
    {
        const string json = """
            [
              { "id": 15, "name": "Labial", "reference": { "reference": "ACO011" }, "status": "active",
                "price": [ { "idPriceList": 1, "price": "25000.50" } ], "inventory": { "availableQuantity": 3.0 } },
              { "id": "16", "name": "Servicio", "reference": "SRV001", "status": "inactive",
                "price": [ { "idPriceList": "1", "price": 1000 } ] }
            ]
            """;

        var items = JsonSerializer.Deserialize<List<AlegraItem>>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        Assert.Equal(("15", "ACO011", true, "1", 25000.50m, 3m), (items[0].Id, items[0].Reference, items[0].IsActive, items[0].Price[0].IdPriceList, items[0].Price[0].Price, items[0].Inventory!.AvailableQuantity));
        Assert.Equal(("16", "SRV001", false), (items[1].Id, items[1].Reference, items[1].IsActive));
        Assert.Null(items[1].Inventory);
    }

    [Fact]
    public async Task ClientReadsEveryPageWithBasicAuthentication()
    {
        var handler = new StubHandler(request =>
        {
            var start = int.Parse(System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)["start"]!);
            var count = start == 0 ? 2 : 1;
            var page = Enumerable.Range(start, count).Select(index => new { id = index, reference = "REF" + index.ToString("000") });
            return Json(HttpStatusCode.OK, page);
        });

        var items = await Client(handler, pageSize: 2).GetItemsAsync(default);

        Assert.Equal(new[] { "REF000", "REF001", "REF002" }, items.Select(item => item.Reference));
        Assert.Equal(2, handler.Requests.Count);
        Assert.Equal("Basic", handler.Requests[0].Headers.Authorization?.Scheme);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "credenciales")]
    [InlineData(HttpStatusCode.TooManyRequests, "limitó")]
    [InlineData(HttpStatusCode.InternalServerError, "error (500)")]
    public async Task ClientTurnsAlegraErrorsIntoReadableMessages(HttpStatusCode status, string expected)
    {
        var client = Client(new StubHandler(_ => new HttpResponseMessage(status)), pageSize: 30);

        var exception = await Assert.ThrowsAsync<AlegraException>(() => client.GetItemsAsync(default));

        Assert.Contains(expected, exception.Message);
    }

    // ----- Utilidades -----

    private static AlegraItem Item(string? id, string? reference, string? name, decimal price, int quantity, string? description = null, string status = "active") => new()
    {
        Id = id,
        Reference = reference,
        Name = name,
        Description = description,
        Status = status,
        Price = [new AlegraItemPrice { IdPriceList = "1", Price = price }],
        Inventory = new AlegraItemInventory { AvailableQuantity = quantity }
    };

    private Task<AlegraProductSyncResult> SyncAsync(params AlegraItem[] items) => SyncAsync(new AlegraOptions(), items);

    private async Task<AlegraProductSyncResult> SyncAsync(AlegraOptions options, params AlegraItem[] items)
    {
        var result = await Service(options, new AlegraSyncLock(), items).SyncAsync(default);
        // Cada corrida es una peticion distinta: sin entidades en memoria de la anterior.
        db.ChangeTracker.Clear();
        linksDb.ChangeTracker.Clear();
        return result;
    }

    private AlegraProductSyncService Service(AlegraOptions options, AlegraSyncLock syncLock, params AlegraItem[] items)
    {
        var alegra = new Mock<IAlegraClient>();
        alegra.Setup(client => client.GetItemsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(items);

        // El servicio real, observado para saber cuantas veces se carga el detalle.
        var real = new ProductService(new ProductRepository(db), new BrandRepository(db), new CategoryRepository(db), new PriceTypeRepository(db), Mock.Of<IFileStorage>());
        products = new Mock<IProductService>();
        products.Setup(s => s.GetAllAsync(It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns((int? b, int? c, bool? a, bool? h, string? s, CancellationToken t) => real.GetAllAsync(b, c, a, h, s, t));
        products.Setup(s => s.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Returns((int id, CancellationToken t) => real.GetByIdAsync(id, t));
        products.Setup(s => s.UpdateAsync(It.IsAny<int>(), It.IsAny<UpdateProductRequest>(), It.IsAny<CancellationToken>()))
            .Returns((int id, UpdateProductRequest r, CancellationToken t) => real.UpdateAsync(id, r, t));
        products.Setup(s => s.SetPricesAsync(It.IsAny<int>(), It.IsAny<SetProductPricesRequest>(), It.IsAny<CancellationToken>()))
            .Returns((int id, SetProductPricesRequest r, CancellationToken t) => real.SetPricesAsync(id, r, t));
        products.Setup(s => s.AdjustInventoryAsync(It.IsAny<int>(), It.IsAny<AdjustInventoryRequest>(), It.IsAny<CancellationToken>()))
            .Returns((int id, AdjustInventoryRequest r, CancellationToken t) => real.AdjustInventoryAsync(id, r, t));
        products.Setup(s => s.CreateAsync(It.IsAny<CreateProductRequest>(), It.IsAny<CancellationToken>()))
            .Returns((CreateProductRequest r, CancellationToken t) => real.CreateAsync(r, t));

        return new AlegraProductSyncService(
            alegra.Object,
            products.Object,
            new PriceTypeService(new PriceTypeRepository(db)),
            linksDb,
            syncLock,
            Options.Create(options),
            NullLogger<AlegraProductSyncService>.Instance);
    }

    private async Task<(string AlegraItemId, int ProductId)> LinkAsync(int productId)
    {
        var link = await linksDb.ProductLinks.AsNoTracking().SingleAsync(item => item.ProductId == productId);
        return (link.AlegraItemId, link.ProductId);
    }

    private static AlegraClient Client(HttpMessageHandler handler, int pageSize)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://alegra.test/api/v1/") };
        http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", "dGVzdDp0b2tlbg==");

        return new AlegraClient(http, Options.Create(new AlegraOptions { PageSize = pageSize }), NullLogger<AlegraClient>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode status, object body) => new(status)
    {
        Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
    };

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
    }

    private async Task<Product> LoadAsync(string reference) =>
        await db.Products.AsNoTracking()
            .Include(product => product.Prices)
            .Include(product => product.Variants)
            .SingleAsync(product => product.Reference == reference);

    private static MagicBeautyDbContext CreateStoreDatabase()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new MagicBeautyDbContext(options);
        db.Brands.Add(new Brand { Id = 1, Name = "Milagros" });
        db.PriceTypes.AddRange(
            new PriceType { Id = Retail, Code = "DETAL", Name = "Detal", IsDefault = true, IsActive = true },
            new PriceType { Id = Wholesale, Code = "MAYORISTA", Name = "Mayorista", IsActive = true });
        db.Products.AddRange(
            new Product
            {
                Id = 1, Reference = "ACO011", Name = "Labial rojo", BrandId = 1, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt,
                Prices =
                [
                    new ProductPrice { PriceTypeId = Retail, Amount = 20000m, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt },
                    new ProductPrice { PriceTypeId = Wholesale, Amount = 15000m, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt }
                ],
                Variants = [new ProductVariant { Name = "DEFAULT", Quantity = 10, IsDefault = true, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt }]
            },
            new Product
            {
                Id = 2, Reference = "TON001", Name = "Paleta de tonos", BrandId = 1, HasVariants = true, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt,
                Variants =
                [
                    new ProductVariant { Name = "Rosa", Quantity = 4, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt },
                    new ProductVariant { Name = "Coral", Quantity = 6, IsActive = true, CreatedAt = SeededAt, UpdatedAt = SeededAt }
                ]
            });
        db.SaveChanges();
        db.ChangeTracker.Clear();
        return db;
    }
}
