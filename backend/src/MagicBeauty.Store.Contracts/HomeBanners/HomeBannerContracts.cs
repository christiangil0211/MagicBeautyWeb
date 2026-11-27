namespace MagicBeauty.Store.Contracts.HomeBanners;

/// <summary>Enlace a una ruta interna de la tienda (empieza por "/").</summary>
public sealed class HomeBannerLinkDto
{
    public string Label { get; set; } = string.Empty;

    public string Link { get; set; } = string.Empty;
}

/// <summary>Zona clicable sobre un botón dibujado, en % del ancho y alto de la imagen.</summary>
public sealed class HomeBannerHotspotDto
{
    public string Label { get; set; } = string.Empty;

    public string Link { get; set; } = string.Empty;

    public decimal Left { get; set; }

    public decimal Top { get; set; }

    public decimal Width { get; set; }

    public decimal Height { get; set; }
}

/// <summary>Crear o editar un banner. La imagen se sube aparte (necesita el Id).</summary>
public sealed class SaveHomeBannerRequest
{
    public string? Name { get; set; }

    public string? Title { get; set; }

    public string? AltText { get; set; }

    public HomeBannerLinkDto? Link { get; set; }

    public List<HomeBannerHotspotDto>? Hotspots { get; set; }

    public List<HomeBannerLinkDto>? MobileCtas { get; set; }

    public string? NoteHighlight { get; set; }

    public string? NoteText { get; set; }

    public DateOnly? StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>Nuevo orden del carrusel: todos los Id, del primero al último.</summary>
public sealed class ReorderHomeBannersRequest
{
    public List<int>? Ids { get; set; }
}

/// <summary>Banner para el carrusel de la tienda (solo los visibles hoy).</summary>
public class PublicHomeBannerDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string AltText { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public int ImageWidth { get; set; }

    public int ImageHeight { get; set; }

    public string? ImageUrl768 { get; set; }

    public string? ImageUrl1280 { get; set; }

    public HomeBannerLinkDto? Link { get; set; }

    public List<HomeBannerHotspotDto> Hotspots { get; set; } = [];

    public List<HomeBannerLinkDto> MobileCtas { get; set; } = [];

    public string? NoteHighlight { get; set; }

    public string? NoteText { get; set; }
}

/// <summary>Banner en el administrador: además, su vigencia, estado y orden.</summary>
public sealed class HomeBannerDto : PublicHomeBannerDto
{
    public DateOnly? StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    /// <summary>Si hoy aparece en la tienda (activo, con imagen y dentro de su vigencia).</summary>
    public bool IsVisibleToday { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
