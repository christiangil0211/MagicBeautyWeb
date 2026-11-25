using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MagicBeauty.Store.Integrations.Alegra.Client;

/// <summary>
/// Item (producto) de Alegra con solo los campos que usa la tienda. La API de
/// Alegra no es uniforme entre cuentas y versiones: los ids pueden llegar como
/// numero o texto, los importes como texto, y la referencia como texto o como
/// objeto <c>{ "reference": "..." }</c>. Los convertidores de abajo aceptan todo eso.
/// </summary>
public sealed class AlegraItem
{
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Id { get; set; }

    public string? Name { get; set; }

    public string? Description { get; set; }

    [JsonConverter(typeof(AlegraReferenceConverter))]
    public string? Reference { get; set; }

    /// <summary>"active" o "inactive".</summary>
    public string? Status { get; set; }

    public List<AlegraItemPrice> Price { get; set; } = [];

    /// <summary>Null cuando el item no maneja inventario (un servicio, por ejemplo).</summary>
    public AlegraItemInventory? Inventory { get; set; }

    public bool IsActive => !string.Equals(Status, "inactive", StringComparison.OrdinalIgnoreCase);
}

public sealed class AlegraItemPrice
{
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? IdPriceList { get; set; }

    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Price { get; set; }
}

public sealed class AlegraItemInventory
{
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? AvailableQuantity { get; set; }
}

/// <summary>Acepta texto o numero y lo guarda como texto.</summary>
internal sealed class FlexibleStringConverter : JsonConverter<string?>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => reader.TryGetInt64(out var number)
                ? number.ToString(CultureInfo.InvariantCulture)
                : reader.GetDecimal().ToString(CultureInfo.InvariantCulture),
            JsonTokenType.Null => null,
            _ => SkipAndReturnNull(ref reader)
        };

    public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value);

    internal static string? SkipAndReturnNull(ref Utf8JsonReader reader)
    {
        reader.Skip();
        return null;
    }
}

/// <summary>Acepta numero o texto ("12500.5") y devuelve decimal.</summary>
internal sealed class FlexibleDecimalConverter : JsonConverter<decimal?>
{
    public override decimal? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.Number:
                return reader.GetDecimal();
            case JsonTokenType.String:
                return decimal.TryParse(reader.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
                    ? value
                    : null;
            case JsonTokenType.Null:
                return null;
            default:
                reader.Skip();
                return null;
        }
    }

    public override void Write(Utf8JsonWriter writer, decimal? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteNumberValue(value.Value);
    }
}

/// <summary>La referencia llega como texto o como objeto <c>{ "reference": "..." }</c>.</summary>
internal sealed class AlegraReferenceConverter : JsonConverter<string?>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String) return reader.GetString();
        if (reader.TokenType != JsonTokenType.StartObject) return FlexibleStringConverter.SkipAndReturnNull(ref reader);

        using var document = JsonDocument.ParseValue(ref reader);
        return document.RootElement.TryGetProperty("reference", out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value);
}
