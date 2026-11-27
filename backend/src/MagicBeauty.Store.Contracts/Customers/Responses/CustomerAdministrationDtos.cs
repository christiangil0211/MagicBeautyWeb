namespace MagicBeauty.Store.Contracts.Customers.Responses;

public sealed record CustomerPage<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record CustomerAccountDto(
    int Id, string? FullName, string Email, string? Phone, string? City, string? DocumentNumber,
    string RoleCode, string RoleName, bool IsActive, bool EmailConfirmed, byte[] RowVersion);

public sealed record CommercialRoleDto(string Code, string Name);

public sealed record PendingRoleRequestDto(
    long Id, string? FullName, string Email, string DocumentNumber, string RequestedRoleCode, string RequestedRoleName,
    DateTimeOffset CreatedAt, DateOnly? LastPurchaseAt, int InvoiceCount, decimal Total, byte[] RowVersion, byte[] UserRowVersion);
