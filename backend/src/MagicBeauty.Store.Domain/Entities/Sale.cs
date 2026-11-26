namespace MagicBeauty.Store.Domain.Entities;

public enum SaleStatus { Unknown, Open, Closed, Draft, Voided }

public sealed class Sale
{
    public long Id { get; set; }
    public string Source { get; set; } = "";
    public string ExternalId { get; set; } = "";
    public DateOnly SaleDate { get; set; }
    public SaleStatus Status { get; set; }
    public DateTimeOffset ImportedAt { get; set; }
    public ICollection<SaleLine> Lines { get; } = new List<SaleLine>();
}

public sealed class SaleLine
{
    public long Id { get; set; }
    public long SaleId { get; set; }
    public int? ProductId { get; set; }
    public string ExternalItemId { get; set; } = "";
    public string? Reference { get; set; }
    public string? Name { get; set; }
    public decimal Quantity { get; set; }
}

public sealed class SourceItemMapping
{
    public string Source { get; set; } = "";
    public string ExternalItemId { get; set; } = "";
    public int ProductId { get; set; }
}

public enum ImportStatus { Queued, Running, Succeeded, Failed }

public sealed class ImportRun
{
    public Guid Id { get; set; }
    public string Source { get; set; } = "";
    public ImportStatus Status { get; set; }
    public bool? Active { get; set; }
    public DateOnly From { get; set; }
    public DateOnly Through { get; set; }
    public DateOnly? LastSaleDate { get; set; }
    public int NextOffset { get; set; }
    public bool AllPagesRead { get; set; }
    public int Pages { get; set; }
    public int Invoices { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public string? Error { get; set; }
}
