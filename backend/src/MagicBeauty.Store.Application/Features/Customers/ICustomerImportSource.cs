namespace MagicBeauty.Store.Application.Features.Customers;

public sealed record ImportedCustomer(
    string? ExternalId, string? DocumentNumber, string? Name, string? Email, string? Phone,
    string? City, string? BillingAddress);

public sealed record CustomerBatch(IReadOnlyList<ImportedCustomer> Customers, int NextOffset, bool Complete);

public interface ICustomerImportSource
{
    string Source { get; }
    bool IsEnabled { get; }

    /// <summary>Lee contactos de facturación sin crear cuentas web ni emitir comunicaciones.</summary>
    Task<CustomerBatch> ReadAsync(int offset, CancellationToken cancellationToken);
}

public interface ICustomerBatchWriter
{
    /// <summary>Guarda el lote y su punto de reanudación juntos.</summary>
    Task WriteAsync(Guid runId, CustomerBatch batch, CancellationToken cancellationToken);
}
