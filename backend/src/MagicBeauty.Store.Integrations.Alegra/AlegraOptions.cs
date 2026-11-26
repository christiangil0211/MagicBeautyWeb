namespace MagicBeauty.Store.Integrations.Alegra;

/// <summary>
/// Configuracion de la seccion <c>Integrations:Alegra</c>. El correo y el token son
/// secretos: van en appsettings.{Ambiente}.json (no versionado) o en la
/// configuracion de Azure (<c>Integrations__Alegra__Token</c>).
/// </summary>
public sealed class AlegraOptions
{
    public const string SectionName = "Integrations:Alegra";

    /// <summary>Apagada por defecto: el boton del administrador no aparece.</summary>
    public bool Enabled { get; set; }

    public string BaseUrl { get; set; } = "https://api.alegra.com/api/v1/";

    /// <summary>Usuario de la API: el correo de la cuenta de Alegra.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Token de la API (Alegra › Configuración › Integraciones).</summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>Lista de precios de Alegra que se trae (1 = la lista general).</summary>
    public int PriceListId { get; set; } = 1;

    /// <summary>
    /// Codigo del tipo de precio de la tienda que recibe ese precio. Vacio = el tipo
    /// de precio predeterminado.
    /// </summary>
    public string? PriceTypeCode { get; set; }

    /// <summary>Alegra devuelve como maximo 30 items por pagina.</summary>
    public int PageSize { get; set; } = 30;

    public int TimeoutSeconds { get; set; } = 30;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Token) && !string.IsNullOrWhiteSpace(BaseUrl);
}
