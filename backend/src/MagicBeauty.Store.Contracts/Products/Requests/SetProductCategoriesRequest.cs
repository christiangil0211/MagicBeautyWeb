namespace MagicBeauty.Store.Contracts.Products.Requests;

/// <summary>Reemplaza por completo las categorias asociadas al producto.</summary>
public sealed class SetProductCategoriesRequest
{
    public List<int> CategoryIds { get; set; } = [];
}
