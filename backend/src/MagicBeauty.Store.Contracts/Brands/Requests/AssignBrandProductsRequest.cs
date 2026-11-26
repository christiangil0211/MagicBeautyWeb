namespace MagicBeauty.Store.Contracts.Brands.Requests;

public sealed class AssignBrandProductsRequest
{
    public List<int> ProductIds { get; set; } = [];

    /// <summary>
    /// Confirmación de la persona: mueve también los productos que ya tienen otra
    /// marca. Sin ella, el API responde 409 con la lista de esos productos.
    /// </summary>
    public bool MoveFromOtherBrands { get; set; }
}
