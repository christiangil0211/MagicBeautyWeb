using MagicBeauty.Store.Domain.Common;

namespace MagicBeauty.Store.Api.Security;

public static class AuthorizationPolicies
{
    /// <summary>Administracion de la tienda: catalogo, productos, marcas, categorias y usuarios.</summary>
    public const string StoreAdmin = "StoreAdmin";

    /// <summary>Codigo del rol en la tabla Roles; es el valor del claim de rol.</summary>
    public const string AdminRole = RoleCodes.Admin;

    /// <summary>Limite de peticiones para inicio de sesion y verificacion de codigo.</summary>
    public const string AuthRateLimit = "auth";
}
