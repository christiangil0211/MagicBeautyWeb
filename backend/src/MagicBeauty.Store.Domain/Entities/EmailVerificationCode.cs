namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Codigo de un solo uso enviado al correo para confirmarlo. Solo se guarda su
/// hash; caduca y admite un numero limitado de intentos.
/// </summary>
public sealed class EmailVerificationCode
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    public string CodeHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public int Attempts { get; set; }

    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
