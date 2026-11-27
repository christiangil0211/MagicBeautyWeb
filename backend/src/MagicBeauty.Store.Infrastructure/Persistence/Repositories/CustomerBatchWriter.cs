using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Domain.Common;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class CustomerBatchWriter(MagicBeautyDbContext db) : ICustomerBatchWriter
{
    public Task WriteAsync(Guid runId, CustomerBatch batch, CancellationToken cancellationToken) =>
        db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await SalesImportLock.EnsureHeldAsync(db, cancellationToken);
            var run = await db.Set<ImportRun>().SingleAsync(x => x.Id == runId, cancellationToken);
            if (run.Status != ImportStatus.Running || run.Kind != ImportKind.Customers)
                throw new InvalidOperationException("La importación de contactos ya no está activa.");

            if (run.AllPagesRead || run.NextOffset >= batch.NextOffset && !batch.Complete) return;

            var rows = batch.Customers.Select(source => source with
            {
                ExternalId = source.ExternalId?.Trim(),
                DocumentNumber = CustomerDocument.Normalize(source.DocumentNumber),
                Name = source.Name?.Trim()
            }).ToArray();
            var keys = rows.Select(x => x.ExternalId).OfType<string>().Distinct().ToArray();
            var documents = rows.Select(x => x.DocumentNumber).OfType<string>().Distinct().ToArray();
            var existing = await db.Customers.Where(x => x.Source == run.Source &&
                    (keys.Contains(x.ExternalId) || documents.Contains(x.DocumentNumber)))
                .ToListAsync(cancellationToken);
            var byKey = existing.ToDictionary(x => x.ExternalId, StringComparer.OrdinalIgnoreCase);
            var byDocument = existing.ToDictionary(x => x.DocumentNumber, StringComparer.OrdinalIgnoreCase);

            foreach (var row in rows)
            {
                if (row.ExternalId is not { Length: > 0 and <= 128 } key || row.DocumentNumber is not { } document ||
                    row.Name is not { Length: > 0 and <= 200 } name)
                {
                    run.SkippedContacts++;
                    continue;
                }

                var customer = byKey.GetValueOrDefault(key);
                var identified = byDocument.GetValueOrDefault(document);
                if ((customer is not null && customer.DocumentNumber != document) ||
                    (identified is not null && !ReferenceEquals(identified, customer)))
                {
                    run.SkippedContacts++;
                    continue;
                }

                if (customer is null)
                {
                    customer = new Customer { Source = run.Source, ExternalId = key, DocumentNumber = document };
                    db.Customers.Add(customer);
                    byKey.Add(key, customer);
                    byDocument.Add(document, customer);
                }

                customer.Name = name;
                customer.Email = Optional(row.Email, 254);
                customer.Phone = Optional(row.Phone, 32);
                customer.City = Optional(row.City, 120);
                customer.BillingAddress = Optional(row.BillingAddress, 300);
                run.Contacts++;
            }

            run.Pages++;
            run.NextOffset = batch.NextOffset;
            run.AllPagesRead = batch.Complete;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });

    private static string? Optional(string? value, int maxLength) =>
        value?.Trim() is { Length: > 0 } text && text.Length <= maxLength ? text : null;
}
