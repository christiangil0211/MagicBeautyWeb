namespace MagicBeauty.Store.Contracts.Customers.Responses;

public sealed record CustomerImportRunDto(Guid Id, string Status, int Pages, int Contacts, int SkippedContacts, string? Error);
