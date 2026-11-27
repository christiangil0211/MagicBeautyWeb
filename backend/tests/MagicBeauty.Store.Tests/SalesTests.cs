using System.Net;
using System.Net.Http.Headers;
using System.Text;
using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Api.Sales;
using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Contracts.Catalog.Responses;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Integrations.Alegra;
using MagicBeauty.Store.Integrations.Alegra.Client;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

public sealed class SalesTests
{
    private static readonly DateOnly Day = new(2026, 11, 26);
    private static readonly TimeProvider Clock = new FixedClock();

    [Fact]
    public async Task ReimportReplacesLinesWithoutMergingRepeatedItemsAndPreservesVoidStatus()
    {
        await using var db = CreateDatabase();
        var first = await AddRunAsync(db);
        db.Add(new SourceItemMapping { Source = "test", ExternalItemId = "item", ProductId = 10 });
        await db.SaveChangesAsync();

        var writer = new SalesBatchWriter(db, Clock);
        await writer.WriteAsync(first, Batch(Document("invoice", SaleStatus.Open, 2, 5)), default);

        var original = await db.Set<Sale>().Include(x => x.Lines).SingleAsync();
        Assert.Equal(new[] { 2m, 5m }, original.Lines.Select(x => x.Quantity).OrderBy(x => x));
        Assert.All(original.Lines, line => Assert.Equal(10, line.ProductId));

        var next = await AddRunAsync(db);
        await writer.WriteAsync(next, Batch(Document("invoice", SaleStatus.Voided, 2, 5)), default);

        db.ChangeTracker.Clear();
        var updated = await db.Set<Sale>().Include(x => x.Lines).SingleAsync();
        Assert.Equal(original.Id, updated.Id);
        Assert.Equal(SaleStatus.Voided, updated.Status);
        Assert.Equal(2, updated.Lines.Count);
        Assert.Equal(2, await db.Set<SaleLine>().CountAsync());
    }

    [Fact]
    public async Task ReimportLinksInvoicesOnlyToMatchingCustomersFromTheirSource()
    {
        await using var db = CreateDatabase();
        var customer = new Customer { Source = "test", ExternalId = "contact", DocumentNumber = "1234567", Name = "Local" };
        db.Customers.AddRange(customer, new Customer
        {
            Source = "other", ExternalId = "contact", DocumentNumber = "1234567", Name = "Otra fuente"
        });
        await db.SaveChangesAsync();
        var writer = new SalesBatchWriter(db, Clock);
        var run = await AddRunAsync(db);
        await writer.WriteAsync(run, Batch(
            Document("matching", SaleStatus.Open, 1) with { CustomerExternalId = "contact", CustomerDocumentNumber = "1.234.567" },
            Document("conflicting", SaleStatus.Open, 1) with { CustomerExternalId = "contact", CustomerDocumentNumber = "998877" }),
            default);

        var sales = await db.Sales.ToDictionaryAsync(sale => sale.ExternalId);
        Assert.Equal(customer.Id, sales["matching"].CustomerId);
        Assert.Null(sales["conflicting"].CustomerId);
        Assert.Equal("1234567", sales["matching"].CustomerDocumentNumber);
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task AValidInvoiceWithoutCustomerIdentityCannotSupportCommercialExpiration()
    {
        await using var db = CreateDatabase();
        var id = await AddRunAsync(db);
        (await db.Set<ImportRun>().SingleAsync()).CapturesCustomerEvidence = true;
        await db.SaveChangesAsync();

        await new SalesBatchWriter(db, Clock).WriteAsync(id, Batch(Document("anonymous", SaleStatus.Closed, 1)), default);

        Assert.Single(db.Sales);
        var run = await db.Set<ImportRun>().SingleAsync();
        Assert.True(run.AllPagesRead);
        Assert.False(run.CapturesCustomerEvidence);
    }

    [Fact]
    public async Task ContactImportIsIdempotentAndDoesNotCreateWebAccounts()
    {
        await using var db = CreateDatabase();
        var runId = await AddRunAsync(db);
        var run = await db.Set<ImportRun>().SingleAsync();
        run.Kind = ImportKind.Customers;
        await db.SaveChangesAsync();
        var writer = new CustomerBatchWriter(db);
        var page = new CustomerBatch(
            [new("contact", "001.234", "Contacto", null, null, null, null),
             new("collision", "001234", "Otro", null, null, null, null)], 2, true);
        await writer.WriteAsync(runId, page, default);
        await writer.WriteAsync(runId, page, default);

        var customer = await db.Customers.SingleAsync();
        Assert.Equal("001234", customer.DocumentNumber);
        Assert.Equal("contact", customer.ExternalId);
        Assert.Empty(db.Users);
        var completed = await db.Set<ImportRun>().SingleAsync();
        Assert.Equal(1, completed.Pages);
        Assert.Equal(1, completed.Contacts);
        Assert.Equal(1, completed.SkippedContacts);
    }

    [Fact]
    public async Task InvalidDocumentPreventsSavingTheLotAndAdvancingTheCheckpoint()
    {
        await using var db = CreateDatabase();
        var runId = await AddRunAsync(db);
        var writer = new SalesBatchWriter(db, Clock);
        var invalid = Document("", SaleStatus.Open, 3);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            writer.WriteAsync(runId, Batch(Document("good", SaleStatus.Closed, 2), invalid), default));

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Set<Sale>().ToListAsync());
        var run = await db.Set<ImportRun>().FindAsync(runId);
        Assert.Equal(0, run!.NextOffset);
        Assert.Equal(0, run.Pages);
        Assert.False(run.AllPagesRead);
    }

    [Fact]
    public async Task ListsInvoicesWithDateFiltersAndRetriesAfter429()
    {
        var handler = new InvoiceHandler();
        using var http = new HttpClient(handler) { BaseAddress = new Uri("https://example.invalid/api/v1/") };
        var client = new AlegraClient(http, Options.Create(new AlegraOptions()), NullLogger<AlegraClient>.Instance);

        var invoices = await client.GetInvoicesAsync(Day.AddDays(-7), Day, 30, 30, default);

        Assert.Equal(2, handler.Requests.Count);
        Assert.Equal(handler.Requests[0], handler.Requests[1]);
        Assert.Contains("date_afterOrNow=2026-11-19", handler.Requests[0]);
        Assert.Contains("date_beforeOrNow=2026-11-26", handler.Requests[0]);
        Assert.Equal("2", Assert.Single(invoices).Id);
        Assert.Equal(1.5m, Assert.Single(invoices[0].Items!).Quantity);
    }

    [Fact]
    public async Task ActiveRunReturnsConflictAndUninitializedQueueCannotStart()
    {
        await using var db = CreateDatabase();
        var queue = new SalesImportQueue();
        var source = new Mock<ISalesSource>(MockBehavior.Strict);
        var controller = new SalesImportsController(db, [source.Object], queue, Clock, Configuration()) { Url = Mock.Of<IUrlHelper>() };

        var unavailable = Assert.IsType<ObjectResult>(await controller.Start(null, default));
        Assert.Equal(503, unavailable.StatusCode);
        source.VerifyNoOtherCalls();

        var activeId = await AddRunAsync(db);
        queue.MarkReady();
        var conflict = Assert.IsType<ConflictObjectResult>(await controller.Start(null, default));
        Assert.Equal(activeId, conflict.Value!.GetType().GetProperty("id")!.GetValue(conflict.Value));
        source.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task OnlyExplicitStartCreatesAndQueuesAThreeMonthRun()
    {
        await using var db = CreateDatabase();
        var queue = new SalesImportQueue();
        queue.MarkReady();
        var source = new Mock<ISalesSource>(MockBehavior.Strict);
        source.SetupGet(x => x.Source).Returns("test");
        source.SetupGet(x => x.IsEnabled).Returns(true);
        var controller = new SalesImportsController(db, [source.Object], queue, Clock, Configuration());

        Assert.IsType<NoContentResult>(await controller.Latest(default));
        Assert.Empty(await db.Set<ImportRun>().ToListAsync());
        source.VerifyNoOtherCalls();

        var response = Assert.IsType<AcceptedAtActionResult>(await controller.Start(null, default));
        var run = await db.Set<ImportRun>().SingleAsync();
        Assert.Equal(run.Id, response.RouteValues!["id"]);
        Assert.Equal((Day.AddMonths(-3), Day, ImportStatus.Queued), (run.From, run.Through, run.Status));
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(1));
        await using var reader = queue.ReadAsync(timeout.Token).GetAsyncEnumerator();
        Assert.True(await reader.MoveNextAsync());
        Assert.Equal(run.Id, reader.Current);
        source.Verify(x => x.ReadAsync(It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task EmptyImportKeepsTheLastObservedSaleDateForTheNextOverlap()
    {
        await using var db = CreateDatabase();
        db.AddRange(
            new ImportRun
            {
                Id = Guid.NewGuid(), Source = "test", Status = ImportStatus.Succeeded,
                Through = Day.AddDays(-9), LastSaleDate = Day.AddDays(-10), FinishedAt = Clock.GetUtcNow().AddDays(-9)
            },
            new ImportRun
            {
                Id = Guid.NewGuid(), Source = "test", Status = ImportStatus.Succeeded,
                Through = Day.AddDays(-1), FinishedAt = Clock.GetUtcNow().AddDays(-1)
            });
        await db.SaveChangesAsync();

        var queue = new SalesImportQueue();
        queue.MarkReady();
        var source = new Mock<ISalesSource>();
        source.SetupGet(x => x.Source).Returns("test");
        source.SetupGet(x => x.IsEnabled).Returns(true);
        var controller = new SalesImportsController(db, [source.Object], queue, Clock, Configuration());

        Assert.IsType<AcceptedAtActionResult>(await controller.Start(null, default));
        var run = await db.Set<ImportRun>().SingleAsync(x => x.Active == true);
        Assert.Equal(Day.AddDays(-17), run.From);
    }

    [Fact]
    public async Task RankingIncludesDescendantsDeduplicatesAndUsesFillWithoutAnAdapter()
    {
        await using var db = CreateDatabase();
        db.AddRange(
            new Category { Id = 1, Slug = "root" },
            new Category { Id = 2, ParentCategoryId = 1, Slug = "child" },
            new Category { Id = 3, ParentCategoryId = 2, Slug = "grandchild" },
            new Category { Id = 4, Slug = "empty-sales" });
        db.AddRange(Product(10, "C", 1, 3), Product(11, "B", 2), Product(12, "A", 1), Product(13, "D", 4));
        db.AddRange(Sale(10, SaleStatus.Closed, 5), Sale(11, SaleStatus.Open, 5),
            Sale(12, SaleStatus.Voided, 999), Sale(13, SaleStatus.Draft, 999));
        await db.SaveChangesAsync();

        var repository = new ProductRepository(db);
        var catalog = new Mock<ICatalogService>();
        catalog.Setup(x => x.GetProductsAsync(null, It.IsAny<int?>(), null, It.IsAny<CancellationToken>()))
            .Returns(async (int? _, int? categoryId, string? _, CancellationToken token) =>
                (await repository.GetAllAsync(null, categoryId, true, null, null, token)).Select(x => Card(x.Id)).ToArray());

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var ranking = new BestSellers(new SalesRankingReader(db), catalog.Object, cache, Clock, Configuration());
        var items = await ranking.GetAsync(1, 30, null, default);
        Assert.Equal(new[] { 10, 11, 12 }, items.Select(x => x.Id));
        Assert.Equal(new bool?[] { true, true, false }, items.Select(x => x.IsBestSeller));
        Assert.False(Assert.Single(await ranking.GetAsync(4, 30, null, default)).IsBestSeller);
        Assert.Equal(new[] { 10, 11 }, (await ranking.GetAsync(null, 30, 16, default)).Select(x => x.Id));

        db.Add(Sale(11, SaleStatus.Closed, 8));
        await db.SaveChangesAsync();
        Assert.Equal(10, (await ranking.GetAsync(1, 30, null, default))[0].Id);
        cache.Remove(SalesImportWorker.RankingCacheKey);
        Assert.Equal(11, (await ranking.GetAsync(1, 30, null, default))[0].Id);
    }

    private static IConfiguration Configuration() => new ConfigurationBuilder().Build();

    private static MagicBeautyDbContext CreateDatabase() =>
        new(new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static async Task<Guid> AddRunAsync(MagicBeautyDbContext db)
    {
        var id = Guid.NewGuid();
        db.Add(new ImportRun
        {
            Id = id, Source = "test", Status = ImportStatus.Running, Active = true, From = Day, Through = Day
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static ImportedSale Document(string id, SaleStatus status, params decimal[] quantities) =>
        new(id, Day, status, quantities.Select(x => new ImportedSaleLine("item", "REF", "Product", x)).ToArray());

    private static SalesBatch Batch(params ImportedSale[] documents) => new(documents, documents.Length, true);

    private static Sale Sale(int productId, SaleStatus status, decimal quantity) =>
        new()
        {
            Source = "test", ExternalId = Guid.NewGuid().ToString(), SaleDate = Day, Status = status,
            Lines = { new SaleLine { ExternalItemId = "item", ProductId = productId, Quantity = quantity } }
        };

    private static Product Product(int id, string name, params int[] categoryIds) =>
        new()
        {
            Id = id, Name = name, Reference = $"REF{id}",
            ProductCategories = categoryIds.Select(categoryId => new ProductCategory
            {
                CategoryId = categoryId, ProductId = id
            }).ToList()
        };

    private static CatalogProductListItemDto Card(int id) =>
        new()
        {
            Id = id, AvailableQuantity = 1, MainImageUrl = "/image.jpg",
            Prices = [new CatalogPriceDto { PriceTypeCode = "RETAIL", Amount = 100 }]
        };

    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 11, 26, 15, 0, 0, TimeSpan.Zero);
    }

    private sealed class InvoiceHandler : HttpMessageHandler
    {
        public List<string> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri!.Query);
            if (Requests.Count == 1)
            {
                var busy = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
                busy.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.Zero);
                busy.Headers.Add("X-Rate-Limit-Reset", "0");
                return Task.FromResult(busy);
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """[{"id":2,"date":"2026-11-26","items":[{"id":"prod","quantity":"1.5"}]}]""",
                    Encoding.UTF8, "application/json")
            });
        }
    }
}
