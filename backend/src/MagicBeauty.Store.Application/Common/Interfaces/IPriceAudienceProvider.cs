using MagicBeauty.Store.Application.Features.Pricing;

namespace MagicBeauty.Store.Application.Common.Interfaces;

/// <summary>
/// Resuelve quien hace la peticion actual en terminos de precios. Lo implementa la
/// capa web, que es la que conoce la identidad del usuario.
/// </summary>
public interface IPriceAudienceProvider
{
    PriceAudience GetCurrent();
}
