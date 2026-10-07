using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Contracts.Categories.Requests;
using MagicBeauty.Store.Contracts.Categories.Responses;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoriesController(ICategoryService categoryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken cancellationToken)
    {
        var categories = await categoryService.GetAllAsync(cancellationToken);

        return Ok(categories);
    }

    [HttpGet("tree")]
    public async Task<ActionResult<IReadOnlyList<CategoryTreeDto>>> GetTree(CancellationToken cancellationToken)
    {
        var categories = await categoryService.GetTreeAsync(cancellationToken);

        return Ok(categories);
    }

    [HttpGet("menu")]
    public async Task<ActionResult<IReadOnlyList<CategoryMenuDto>>> GetMenu(CancellationToken cancellationToken)
    {
        var menu = await categoryService.GetMenuAsync(cancellationToken);

        return Ok(menu);
    }

    [HttpGet("home")]
    public async Task<ActionResult<IReadOnlyList<CategoryTileDto>>> GetHomeTiles(CancellationToken cancellationToken)
    {
        var tiles = await categoryService.GetHomeTilesAsync(cancellationToken);

        return Ok(tiles);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var category = await categoryService.GetByIdAsync(id, cancellationToken);

        return Ok(category);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(
        CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var category = await categoryService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        await categoryService.UpdateAsync(id, request, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await categoryService.DeleteAsync(id, cancellationToken);

        return NoContent();
    }
}