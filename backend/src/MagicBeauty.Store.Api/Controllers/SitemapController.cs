using MagicBeauty.Store.Application.Features.Sitemap;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Sitemap de la tienda. Vive en el API porque es quien conoce los productos y
/// categorias activos; el robots.txt del sitio apunta aqui.
/// </summary>
[ApiController]
[AllowAnonymous]
public sealed class SitemapController(
    ISitemapService sitemapService,
    IConfiguration configuration) : ControllerBase
{
    private const string DefaultSiteUrl = "https://www.magicbeautycosmetics.com";

    [HttpGet("/sitemap.xml")]
    public async Task<ContentResult> Get(CancellationToken cancellationToken)
    {
        var siteUrl = configuration["Store:PublicUrl"];
        var xml = await sitemapService.BuildXmlAsync(
            string.IsNullOrWhiteSpace(siteUrl) ? DefaultSiteUrl : siteUrl,
            cancellationToken);

        // Los buscadores lo consultan pocas veces al dia: una hora de cache basta.
        Response.Headers.CacheControl = "public, max-age=3600";

        return Content(xml, "application/xml; charset=utf-8");
    }
}
