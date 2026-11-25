namespace MagicBeauty.Store.Integrations.Alegra.Sync;

/// <summary>Resumen de una actualizacion de productos desde Alegra.</summary>
public sealed class AlegraProductSyncResult
{
    /// <summary>Items leidos de Alegra.</summary>
    public int Total { get; set; }

    /// <summary>Productos nuevos, creados inactivos para que el administrador los revise.</summary>
    public int Created { get; set; }

    public int Updated { get; set; }

    public int Unchanged { get; set; }

    /// <summary>
    /// Productos existentes que se asociaron por primera vez a su item de Alegra (por
    /// referencia). Desde entonces se cruzan por el id de Alegra.
    /// </summary>
    public int Linked { get; set; }

    /// <summary>Items que no se pudieron llevar a la tienda (sin referencia, formato invalido...).</summary>
    public int Skipped { get; set; }

    public int Failed { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime FinishedAt { get; set; }

    /// <summary>Detalle de lo omitido, lo fallido y los avisos, para mostrarlo al administrador.</summary>
    public List<AlegraSyncIssue> Issues { get; set; } = [];
}

public sealed class AlegraSyncIssue
{
    public const string Skipped = "skipped";
    public const string Error = "error";
    public const string Warning = "warning";

    public string Kind { get; set; } = Warning;

    public string? Reference { get; set; }

    public string? Name { get; set; }

    public string Message { get; set; } = string.Empty;
}
