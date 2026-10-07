namespace MagicBeauty.Store.Contracts.Auth.Responses;

public sealed class SessionDto
{
    public bool IsAuthenticated { get; set; }

    public string? DisplayName { get; set; }

    /// <summary>Resultado de la politica de administracion para el usuario actual.</summary>
    public bool CanManageStore { get; set; }
}
