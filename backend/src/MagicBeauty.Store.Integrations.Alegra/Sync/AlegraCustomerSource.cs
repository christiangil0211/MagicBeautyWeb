using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Integrations.Alegra.Client;
using Microsoft.Extensions.Options;

namespace MagicBeauty.Store.Integrations.Alegra.Sync;

internal sealed class AlegraCustomerSource(AlegraClient client, IOptions<AlegraOptions> options) : ICustomerImportSource
{
    public const string SourceCode = "alegra";
    public string Source => SourceCode;
    public bool IsEnabled => options.Value.Enabled && options.Value.IsConfigured;

    public async Task<CustomerBatch> ReadAsync(int offset, CancellationToken cancellationToken)
    {
        const int pageSize = 30;
        if (offset >= pageSize * 2000)
            throw new SalesSourceReadException("El origen devolvió más páginas de contactos de las esperadas.");

        var contacts = await client.GetContactsAsync(offset, pageSize, cancellationToken);
        return new CustomerBatch(contacts.Select(contact => new ImportedCustomer(
            contact.Id, contact.Document, contact.DisplayName, contact.Email, contact.Mobile ?? contact.PhonePrimary,
            contact.City, contact.Street)).ToArray(), offset + contacts.Count, contacts.Count < pageSize);
    }
}
