namespace MagicBeauty.Store.Application.Common;

/// <summary>
/// Que PDF se aceptan. Como con las imagenes, se decide por la firma real del
/// archivo (%PDF-), no por la extension ni por el Content-Type del cliente.
/// </summary>
public static class PdfUploadRules
{
    /// <summary>Los catalogos exportados de Canva para impresion suelen ser pesados.</summary>
    public const long MaxBytes = 50 * 1024 * 1024;

    public const string ContentType = "application/pdf";

    public const string Extension = ".pdf";

    private static ReadOnlySpan<byte> Signature => "%PDF-"u8;

    /// <summary>Lanza si la cabecera no corresponde a un PDF.</summary>
    public static void EnsurePdf(ReadOnlySpan<byte> header)
    {
        if (!header.StartsWith(Signature))
        {
            throw new ArgumentException("El archivo no es un PDF valido.");
        }
    }
}
