namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Banner del carrusel del inicio (tabla HomeBanners). Es una imagen completa con su
/// texto dibujado, en proporción 3:1. Toda la imagen puede enlazar a una página o,
/// si la imagen tiene botones dibujados, cada botón se cubre con una zona clicable.
/// Solo se muestra si está activo, tiene imagen y hoy (fecha de Colombia) está
/// dentro de su vigencia.
/// </summary>
public sealed class Banner
{
    public int Id { get; set; }

    /// <summary>Nombre corto e interno: lista del administrador y punto del carrusel («Ir al banner de …»).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Título en texto para lectores de pantalla y buscadores (la imagen ya lo lleva dibujado).</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Texto alternativo: todo lo que dice la imagen.</summary>
    public string AltText { get; set; } = string.Empty;

    /// <summary>Imagen original (proporción 3:1). NULL mientras no se haya cargado.</summary>
    public string? ImageUrl { get; set; }

    public int ImageWidth { get; set; }

    public int ImageHeight { get; set; }

    /// <summary>Copia liviana de 768 px para celulares (opcional).</summary>
    public string? ImageUrl768 { get; set; }

    /// <summary>Copia de 1280 px para tabletas y portátiles (opcional).</summary>
    public string? ImageUrl1280 { get; set; }

    /// <summary>Ruta interna a la que lleva toda la imagen. Sin enlace ni zonas, el banner solo informa.</summary>
    public string? LinkUrl { get; set; }

    public string? LinkLabel { get; set; }

    /// <summary>Zonas clicables sobre los botones dibujados (JSON).</summary>
    public string? HotspotsJson { get; set; }

    /// <summary>Botones reales que se muestran debajo en celulares (JSON).</summary>
    public string? MobileCtasJson { get; set; }

    /// <summary>Aviso bajo la imagen: parte destacada.</summary>
    public string? NoteHighlight { get; set; }

    /// <summary>Aviso bajo la imagen: resto del texto.</summary>
    public string? NoteText { get; set; }

    /// <summary>Primer día que se muestra (fecha de Colombia, inclusive). NULL: desde ya.</summary>
    public DateOnly? StartsOn { get; set; }

    /// <summary>Último día que se muestra (fecha de Colombia, inclusive). NULL: sin fin.</summary>
    public DateOnly? EndsOn { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
