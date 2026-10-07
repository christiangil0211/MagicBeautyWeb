namespace MagicBeauty.Store.Contracts.Users.Responses;

public sealed class UserDto
{
    public int Id { get; set; }

    public string Email { get; set; } = string.Empty;

    public bool EmailConfirmed { get; set; }

    /// <summary>Tiene una contrasena temporal que aun no cambia.</summary>
    public bool MustChangePassword { get; set; }

    public DateTime? TemporaryPasswordExpiresAt { get; set; }

    public bool IsActive { get; set; }

    public List<string> Roles { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }
}
