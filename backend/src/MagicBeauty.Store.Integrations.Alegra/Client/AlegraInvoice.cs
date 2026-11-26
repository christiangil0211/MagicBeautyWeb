using System.Text.Json.Serialization;

namespace MagicBeauty.Store.Integrations.Alegra.Client;

internal sealed class AlegraInvoice
{
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Id { get; init; }
    public DateOnly Date { get; init; }
    public string? DueDate { get; init; }
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? PaymentForm { get; init; }
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? PaymentMethod { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Subtotal { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Discount { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Tax { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Total { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? TotalPaid { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Balance { get; init; }
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
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Price { get; init; }
    [JsonConverter(typeof(FlexibleDecimalConverter))]
    public decimal? Total { get; init; }
}
