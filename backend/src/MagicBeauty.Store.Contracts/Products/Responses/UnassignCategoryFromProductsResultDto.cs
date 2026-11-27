namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class UnassignCategoryFromProductsResultDto
{
    /// <summary>Productos a los que se les quito la categoria; los que no la tenian no cuentan.</summary>
    public int UpdatedCount { get; set; }
}
