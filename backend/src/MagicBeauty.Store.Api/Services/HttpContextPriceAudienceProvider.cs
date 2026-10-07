using System.Security.Claims;

using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Pricing;

namespace MagicBeauty.Store.Api.Services;

/// <summary>
/// Traduce la identidad de la peticion a una audiencia de precios. Mientras no
/// exista autenticacion todas las peticiones son anonimas; cuando se agregue, los
/// claims de rol alimentan la relacion Role -> PriceType sin tocar nada mas.
/// </summary>
public sealed class HttpContextPriceAudienceProvider(IHttpContextAccessor httpContextAccessor)
    : IPriceAudienceProvider
{
    public PriceAudience GetCurrent()
    {
        var user = httpContextAccessor.HttpContext?.User;

        if (user?.Identity?.IsAuthenticated != true)
        {
            return PriceAudience.Anonymous;
        }

        var roles = user.FindAll(ClaimTypes.Role).Select(claim => claim.Value);

        return PriceAudience.Authenticated(roles);
    }
}
