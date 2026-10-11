namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class AssignCategoryToProductsResultDto
{
    /// <summary>Productos que recibieron la categoria; los que ya la tenian no cuentan.</summary>
    public int UpdatedCount { get; set; }
}
