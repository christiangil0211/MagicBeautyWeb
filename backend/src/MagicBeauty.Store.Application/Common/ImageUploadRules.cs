namespace MagicBeauty.Store.Application.Common;

/// <summary>
/// Que imagenes se aceptan. El tipo se decide por la firma real del archivo, no
/// por la extension ni por el Content-Type que manda el cliente.
/// </summary>
public static class ImageUploadRules
{
    public const long MaxBytes = 8 * 1024 * 1024;

    public sealed record ImageFormat(string ContentType, string Extension);

    private static readonly ImageFormat Jpeg = new("image/jpeg", ".jpg");
    private static readonly ImageFormat Png = new("image/png", ".png");
    private static readonly ImageFormat Webp = new("image/webp", ".webp");
    private static readonly ImageFormat Gif = new("image/gif", ".gif");

    /// <summary>Lee la cabecera del contenido y devuelve el formato, o lanza si no es una imagen admitida.</summary>
    public static ImageFormat Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            return Jpeg;
        }

        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return Png;
        }

        if (header.Length >= 12 &&
            header[..4].SequenceEqual("RIFF"u8) &&
            header[8..12].SequenceEqual("WEBP"u8))
        {
            return Webp;
        }

        if (header.Length >= 6 && (header[..6].SequenceEqual("GIF87a"u8) || header[..6].SequenceEqual("GIF89a"u8)))
        {
            return Gif;
        }

        throw new ArgumentException("El archivo no es una imagen valida. Usa JPG, PNG, WEBP o GIF.");
    }
}
