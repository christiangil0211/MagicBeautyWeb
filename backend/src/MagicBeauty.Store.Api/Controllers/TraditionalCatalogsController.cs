using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Features.TraditionalCatalogs;
using MagicBeauty.Store.Contracts.TraditionalCatalogs.Requests;
using MagicBeauty.Store.Contracts.TraditionalCatalogs.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Catalogos tradicionales. Todo es administracion salvo el listado publico, que
/// solo entrega catalogos activos (mismo esquema que el menu de categorias).
/// </summary>
[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/traditional-catalogs")]
public sealed class TraditionalCatalogsController(ITraditionalCatalogService catalogService) : ControllerBase
{
    /// <summary>Margen sobre el archivo para el resto del formulario multipart.</summary>
    private const long MultipartOverhead = 1024 * 1024;
    private const long CoverRequestLimit = 8 * 1024 * 1024 + MultipartOverhead;
    private const long PdfRequestLimit = PdfUploadRules.MaxBytes + MultipartOverhead;

    [AllowAnonymous]
    [HttpGet("public")]
    public async Task<ActionResult<IReadOnlyList<PublicTraditionalCatalogDto>>> GetPublic(CancellationToken cancellationToken)
    {
        var catalogs = await catalogService.GetPublicAsync(cancellationToken);

        return Ok(catalogs);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TraditionalCatalogDto>>> GetAll(CancellationToken cancellationToken)
    {
        var catalogs = await catalogService.GetAllAsync(cancellationToken);

        return Ok(catalogs);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TraditionalCatalogDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var catalog = await catalogService.GetByIdAsync(id, cancellationToken);

        return Ok(catalog);
    }

    [HttpPost]
    public async Task<ActionResult<TraditionalCatalogDto>> Create(
        CreateTraditionalCatalogRequest request,
        CancellationToken cancellationToken)
    {
        var catalog = await catalogService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = catalog.Id }, catalog);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        UpdateTraditionalCatalogRequest request,
        CancellationToken cancellationToken)
    {
        await catalogService.UpdateAsync(id, request, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await catalogService.DeleteAsync(id, cancellationToken);

        return NoContent();
    }

    [HttpPut("{id:int}/cover")]
    [RequestSizeLimit(CoverRequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = CoverRequestLimit)]
    public async Task<ActionResult<TraditionalCatalogDto>> UploadCover(
        int id,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        await using var content = file.OpenReadStream();

        return Ok(await catalogService.UploadCoverAsync(id, content, file.Length, cancellationToken));
    }

    [HttpDelete("{id:int}/cover")]
    public async Task<ActionResult<TraditionalCatalogDto>> DeleteCover(int id, CancellationToken cancellationToken)
        => Ok(await catalogService.DeleteCoverAsync(id, cancellationToken));

    [HttpPut("{id:int}/pdf")]
    [RequestSizeLimit(PdfRequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = PdfRequestLimit)]
    public async Task<ActionResult<TraditionalCatalogDto>> UploadPdf(
        int id,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        await using var content = file.OpenReadStream();

        return Ok(await catalogService.UploadPdfAsync(id, content, file.Length, cancellationToken));
    }

    [HttpDelete("{id:int}/pdf")]
    public async Task<ActionResult<TraditionalCatalogDto>> DeletePdf(int id, CancellationToken cancellationToken)
        => Ok(await catalogService.DeletePdfAsync(id, cancellationToken));
}
