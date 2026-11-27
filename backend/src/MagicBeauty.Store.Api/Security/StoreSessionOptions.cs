namespace MagicBeauty.Store.Api.Security;

/// <summary>Equilibra la revocación de permisos con el costo de consultar cada sesión activa.</summary>
public sealed class StoreSessionOptions
{
    public int ValidationIntervalMinutes { get; set; } = 5;
    public int AbsoluteLifetimeHours { get; set; } = 24;
}
