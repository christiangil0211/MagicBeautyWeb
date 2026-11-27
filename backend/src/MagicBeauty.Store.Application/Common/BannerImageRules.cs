using System.Buffers.Binary;

namespace MagicBeauty.Store.Application.Common;

/// <summary>
/// Qué imágenes acepta el carrusel del inicio. El formato y las medidas se leen del
/// contenido del archivo, no de la extensión ni de lo que diga el navegador.
/// La original debe ser 3:1 (la del diseño: 2172 × 724 px) y las copias livianas
/// de 768 y 1280 px deben conservar esa proporción.
/// </summary>
public static class BannerImageRules
{
    public const long MaxOriginalBytes = 3 * 1024 * 1024;
    public const long MaxVariantBytes = 1024 * 1024;

    public const int RecommendedWidth = 2172;
    public const int RecommendedHeight = 724;
    public const int MinWidth = 1600;
    public const int MaxWidth = 4400;

    /// <summary>Ancho ÷ alto del carrusel.</summary>
    public const double AspectRatio = 3.0;

    /// <summary>Margen de redondeo: 2172 × 724 = 3,0 exacto, pero 2000 × 671 también sirve.</summary>
    public const double AspectTolerance = 0.02;

    public static readonly int[] VariantWidths = [768, 1280];

    public sealed record BannerImage(ImageUploadRules.ImageFormat Format, int Width, int Height);

    private static readonly ImageUploadRules.ImageFormat Jpeg = new("image/jpeg", ".jpg");
    private static readonly ImageUploadRules.ImageFormat Png = new("image/png", ".png");
    private static readonly ImageUploadRules.ImageFormat Webp = new("image/webp", ".webp");

    /// <summary>Valida la imagen principal: JPG, PNG o WebP, 3:1 y entre 1600 y 4400 px de ancho.</summary>
    public static BannerImage ValidateOriginal(ReadOnlySpan<byte> content)
    {
        var image = Read(content);

        if (image.Width < MinWidth || image.Width > MaxWidth)
        {
            throw new ArgumentException(
                $"La imagen mide {image.Width} × {image.Height} px. Debe tener entre {MinWidth} y {MaxWidth} px de ancho (ideal {RecommendedWidth} × {RecommendedHeight}).");
        }

        EnsureRatio(image, "La imagen");

        return image;
    }

    /// <summary>Valida una copia liviana: el ancho esperado (±2 px) y la misma proporción.</summary>
    public static BannerImage ValidateVariant(ReadOnlySpan<byte> content, int expectedWidth)
    {
        var image = Read(content);

        if (Math.Abs(image.Width - expectedWidth) > 2)
        {
            throw new ArgumentException($"La copia de {expectedWidth} px mide {image.Width} px de ancho.");
        }

        EnsureRatio(image, $"La copia de {expectedWidth} px");

        return image;
    }

    /// <summary>Formato y medidas leídos de la cabecera. Lanza si no es JPG, PNG o WebP legible.</summary>
    public static BannerImage Read(ReadOnlySpan<byte> content)
    {
        var size = content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF
            ? (Jpeg, ReadJpegSize(content))
            : content.Length >= 24 && content[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })
                ? (Png, ReadPngSize(content))
                : content.Length >= 30 && content[..4].SequenceEqual("RIFF"u8) && content[8..12].SequenceEqual("WEBP"u8)
                    ? (Webp, ReadWebpSize(content))
                    : throw new ArgumentException("El banner debe ser una imagen JPG, PNG o WebP.");

        var (format, (width, height)) = size;

        if (width <= 0 || height <= 0)
        {
            throw new ArgumentException("No se pudieron leer las medidas de la imagen. Expórtala de nuevo como JPG, PNG o WebP.");
        }

        return new BannerImage(format, width, height);
    }

    private static void EnsureRatio(BannerImage image, string subject)
    {
        var ratio = (double)image.Width / image.Height;

        if (Math.Abs(ratio - AspectRatio) / AspectRatio > AspectTolerance)
        {
            throw new ArgumentException(
                $"{subject} mide {image.Width} × {image.Height} px y debe ser 3 veces más ancha que alta (ideal {RecommendedWidth} × {RecommendedHeight}).");
        }
    }

    private static (int Width, int Height) ReadPngSize(ReadOnlySpan<byte> content) =>
        content[12..16].SequenceEqual("IHDR"u8)
            ? ((int)BinaryPrimitives.ReadUInt32BigEndian(content[16..20]), (int)BinaryPrimitives.ReadUInt32BigEndian(content[20..24]))
            : (0, 0);

    private static (int Width, int Height) ReadWebpSize(ReadOnlySpan<byte> content)
    {
        var chunk = content[12..16];

        // Con pérdida: cabecera del cuadro clave tras el código 9D 01 2A.
        if (chunk.SequenceEqual("VP8 "u8) && content[23] == 0x9D && content[24] == 0x01 && content[25] == 0x2A)
        {
            return (BinaryPrimitives.ReadUInt16LittleEndian(content[26..28]) & 0x3FFF,
                BinaryPrimitives.ReadUInt16LittleEndian(content[28..30]) & 0x3FFF);
        }

        // Sin pérdida: 14 bits de ancho-1 y 14 de alto-1 tras la firma 0x2F.
        if (chunk.SequenceEqual("VP8L"u8) && content[20] == 0x2F)
        {
            var bits = BinaryPrimitives.ReadUInt32LittleEndian(content[21..25]);
            return ((int)(bits & 0x3FFF) + 1, (int)((bits >> 14) & 0x3FFF) + 1);
        }

        // Extendido: lienzo de 24 bits (ancho-1, alto-1).
        if (chunk.SequenceEqual("VP8X"u8))
        {
            return (ReadUInt24(content[24..27]) + 1, ReadUInt24(content[27..30]) + 1);
        }

        return (0, 0);
    }

    private static int ReadUInt24(ReadOnlySpan<byte> bytes) => bytes[0] | bytes[1] << 8 | bytes[2] << 16;

    /// <summary>Recorre los segmentos hasta el inicio de cuadro (SOFn), que guarda alto y ancho.</summary>
    private static (int Width, int Height) ReadJpegSize(ReadOnlySpan<byte> content)
    {
        var offset = 2;

        while (offset + 9 < content.Length)
        {
            if (content[offset] != 0xFF)
            {
                return (0, 0);
            }

            var marker = content[offset + 1];

            // Relleno 0xFF entre segmentos.
            if (marker == 0xFF)
            {
                offset++;
                continue;
            }

            // Marcadores sin longitud.
            if (marker is 0x01 or (>= 0xD0 and <= 0xD7))
            {
                offset += 2;
                continue;
            }

            var length = BinaryPrimitives.ReadUInt16BigEndian(content[(offset + 2)..(offset + 4)]);

            if (marker is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC)
            {
                var height = BinaryPrimitives.ReadUInt16BigEndian(content[(offset + 5)..(offset + 7)]);
                var width = BinaryPrimitives.ReadUInt16BigEndian(content[(offset + 7)..(offset + 9)]);
                return (width, height);
            }

            if (marker == 0xDA || length < 2)
            {
                return (0, 0);
            }

            offset += 2 + length;
        }

        return (0, 0);
    }
}
