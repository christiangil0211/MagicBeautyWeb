using System.Text.Json;
using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

public sealed class AdminSalesControllerTests
{
    [Fact]
    public async Task FiltersByDateStatusAndLineReferenceAndReturnsItsDetail()
    {
        await using var db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var date = new DateOnly(2026, 11, 26);
        db.AddRange(Sale(1, date, SaleStatus.Closed, "LAB012"),
            Sale(2, date, SaleStatus.Open, "LAB012"),
            Sale(3, date.AddDays(-1), SaleStatus.Closed, "LAB012"),
            Sale(4, date, SaleStatus.Closed, "POL001"));
        await db.SaveChangesAsync();

        var controller = new AdminSalesController(db);
        var result = Assert.IsType<OkObjectResult>(await controller.List(date, date, SaleStatus.Closed, "LAB", token: default));
        var page = JsonSerializer.SerializeToElement(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(1, page.GetProperty("total").GetInt32());
        var row = Assert.Single(page.GetProperty("items").EnumerateArray());
        Assert.Equal(1L, row.GetProperty("id").GetInt64());
        Assert.Equal(2m, row.GetProperty("units").GetDecimal());

        var detail = Assert.IsType<OkObjectResult>(await controller.Detail(1, default));
        var payload = JsonSerializer.SerializeToElement(detail.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("LAB012", Assert.Single(payload.GetProperty("lines").EnumerateArray()).GetProperty("reference").GetString());
        Assert.IsType<NotFoundResult>(await controller.Detail(99, default));
    }

    private static Sale Sale(long id, DateOnly date, SaleStatus status, string reference) => new()
    {
        Id = id, Source = "test", ExternalId = $"FAC-{id}", SaleDate = date, Status = status,
        Lines = { new SaleLine { ExternalItemId = "item", Reference = reference, Quantity = 2 } }
    };
}
