using System.Text.Json.Serialization;

namespace MagicBeauty.Store.Integrations.Alegra.Client;

internal sealed class AlegraInvoice
{
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Id { get; init; }
    public DateOnly Date { get; init; }
    public string? Status { get; init; }
    public List<AlegraInvoiceLine>? Items { get; init; }
}

internal sealed class AlegraInvoiceLine
{
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Id { get; init; }
    public string? Name { get; init; }
    [JsonConverter(typeof(AlegraReferenceConverter))]
    public string? Reference { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Quantity { get; init; }
}
