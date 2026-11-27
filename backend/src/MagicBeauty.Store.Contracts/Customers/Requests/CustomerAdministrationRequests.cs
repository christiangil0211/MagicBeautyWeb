namespace MagicBeauty.Store.Contracts.Customers.Requests;

public sealed class CustomerListQuery
{
    public string? RoleCode { get; set; }
    public bool? IsActive { get; set; }
    public string? City { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public sealed class ReviewRoleRequest
{
    public bool? Approve { get; set; }
    public string? Note { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public byte[] UserRowVersion { get; set; } = [];
}

public sealed class ChangeCustomerRoleRequest
{
    public string RoleCode { get; set; } = string.Empty;
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ChangeCustomerActiveRequest
{
    public bool? IsActive { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
