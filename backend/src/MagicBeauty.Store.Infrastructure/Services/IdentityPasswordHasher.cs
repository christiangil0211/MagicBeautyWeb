using MagicBeauty.Store.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace MagicBeauty.Store.Infrastructure.Services;

/// <summary>
/// Hasher de ASP.NET Core Identity (PBKDF2 con sal, formato versionado). Se usa
/// solo el algoritmo: los usuarios y roles son los del modelo propio.
/// </summary>
public sealed class IdentityPasswordHasher : Application.Common.Interfaces.IPasswordHasher
{
    private readonly PasswordHasher<User> hasher = new();

    public string Hash(string password)
    {
        return hasher.HashPassword(null!, password);
    }

    public bool Verify(string passwordHash, string password)
    {
        try
        {
            return hasher.VerifyHashedPassword(null!, passwordHash, password)
                is not PasswordVerificationResult.Failed;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
