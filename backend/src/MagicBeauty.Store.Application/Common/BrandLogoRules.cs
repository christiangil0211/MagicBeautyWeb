using System.Text;
using System.Text.RegularExpressions;

namespace MagicBeauty.Store.Application.Common;

/// <summary>
/// Qué logos de marca se aceptan: PNG, WebP o SVG de hasta 1 MB. El tipo se decide
/// por el contenido, no por la extensión ni por el Content-Type del cliente.
/// Un SVG es texto con posibilidad de scripts: se rechaza cualquier contenido
/// activo o referencia externa (además, la tienda lo muestra solo con &lt;img&gt;,
/// que nunca ejecuta scripts).
/// </summary>
public static partial class BrandLogoRules
{
    public const long MaxBytes = 1024 * 1024;

    private static readonly ImageUploadRules.ImageFormat Png = new("image/png", ".png");
    private static readonly ImageUploadRules.ImageFormat Webp = new("image/webp", ".webp");
    private static readonly ImageUploadRules.ImageFormat Svg = new("image/svg+xml", ".svg");

    public static ImageUploadRules.ImageFormat Detect(ReadOnlySpan<byte> content)
    {
        if (content.Length >= 8 && content[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return Png;
        }

        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content[8..12].SequenceEqual("WEBP"u8))
        {
            return Webp;
        }

        if (LooksLikeSvg(content))
        {
            ValidateSvg(content);
            return Svg;
        }

        throw new ArgumentException("El logo debe ser PNG, SVG o WebP.");
    }

    private static bool LooksLikeSvg(ReadOnlySpan<byte> content)
    {
        var head = Encoding.UTF8.GetString(content[..Math.Min(content.Length, 1024)]).TrimStart('﻿').TrimStart();

        return head.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase) && head.Contains("<svg", StringComparison.OrdinalIgnoreCase)
            || head.StartsWith("<svg", StringComparison.OrdinalIgnoreCase)
            || head.StartsWith("<!--", StringComparison.Ordinal) && head.Contains("<svg", StringComparison.OrdinalIgnoreCase);
    }

    private static void ValidateSvg(ReadOnlySpan<byte> content)
    {
        string text;
        try
        {
            text = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true).GetString(content);
        }
        catch (DecoderFallbackException)
        {
            throw new ArgumentException("El SVG no es texto UTF-8 válido.");
        }

        if (!text.Contains("<svg", StringComparison.OrdinalIgnoreCase) || !text.Contains("</svg>", StringComparison.OrdinalIgnoreCase) && !SelfClosingSvg().IsMatch(text))
        {
            throw new ArgumentException("El archivo no es un SVG completo.");
        }

        if (UnsafeSvg().IsMatch(text))
        {
            throw new ArgumentException(
                "El SVG tiene contenido no permitido (scripts, eventos, enlaces externos o declaraciones DOCTYPE/ENTITY). Expórtalo de nuevo como SVG simple, PNG o WebP.");
        }
    }

    [GeneratedRegex(@"<svg\b[^>]*/>", RegexOptions.IgnoreCase)]
    private static partial Regex SelfClosingSvg();

    /// <summary>
    /// Scripts, manejadores on*=, javascript:/data:text, foreignObject, &lt;!DOCTYPE&gt;
    /// o &lt;!ENTITY&gt; (expansión de entidades) y href/src hacia http(s) o //.
    /// </summary>
    [GeneratedRegex(
        @"<\s*script|<\s*foreignObject|<!DOCTYPE|<!ENTITY|\son[a-z]+\s*=|javascript\s*:|data\s*:\s*text|(?:xlink:)?href\s*=\s*[""']?\s*(?:https?:|//)|\bsrc\s*=\s*[""']?\s*(?:https?:|//)|@import",
        RegexOptions.IgnoreCase)]
    private static partial Regex UnsafeSvg();
}
