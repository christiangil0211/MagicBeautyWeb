using MagicBeauty.Store.Application.Features.HomeBanners;
using MagicBeauty.Store.Contracts.HomeBanners;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Carrusel del inicio en la tienda: los banners activos, con imagen y vigentes hoy.
/// Lista vacía si no hay ninguno (la tienda usa entonces los banners de respaldo).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/banners")]
public sealed class PublicHomeBannersController(IHomeBannerService bannerService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PublicHomeBannerDto>>> GetVisible(CancellationToken cancellationToken)
    {
        var banners = await bannerService.GetVisibleAsync(cancellationToken);

        // Un minuto en la caché del navegador alivia la base y un cambio del administrador
        // se ve enseguida. "private": la sesión es deslizante y esta respuesta puede traer
        // la cookie renovada; ningún intermediario (CDN, proxy) debe guardarla.
        Response.Headers.CacheControl = "private, max-age=60";

        return Ok(banners);
    }
}
