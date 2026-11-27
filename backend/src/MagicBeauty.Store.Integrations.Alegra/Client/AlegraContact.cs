using System.Text.Json;
using System.Text.Json.Serialization;

namespace MagicBeauty.Store.Integrations.Alegra.Client;

internal sealed class AlegraContact
{
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Id { get; init; }
    public JsonElement Identification { get; init; }
    public JsonElement IdentificationObject { get; init; }
    public JsonElement Name { get; init; }
    public string? Email { get; init; }
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? PhonePrimary { get; init; }
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Mobile { get; init; }
    public JsonElement Address { get; init; }

    public string? Document => ReadDocument(Identification) ?? ReadDocument(IdentificationObject);

    public string? DisplayName => Text(Name) ?? Text(Property(Name, "name"));

    public string? City => Text(Property(Address, "city"));

    public string? Street => Text(Address) ?? Text(Property(Address, "address"));

    public static string? Text(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => value.GetRawText(),
        _ => null
    };

    public static JsonElement Property(JsonElement value, string property) =>
        value.ValueKind == JsonValueKind.Object && value.TryGetProperty(property, out var result) ? result : default;

    public static string? ReadDocument(JsonElement value) =>
        Text(value) ?? Text(Property(value, "number"));
}
