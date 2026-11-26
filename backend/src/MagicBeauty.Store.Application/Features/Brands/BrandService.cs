using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.Brands.Responses;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Application.Features.Brands;

/// <summary>
/// Marcas del administrador. Un producto tiene como máximo UNA marca
/// (Product.BrandId): asignar a otra marca la reemplaza, nunca se suman.
/// </summary>
public sealed class BrandService(
    IBrandRepository brandRepository,
    IFileStorageFactory storageFactory,
    ILogger<BrandService> logger) : IBrandService
{
    public const int MaxDescriptionLength = 300;
    public const int MaxPageSize = 100;
    public const int MaxProductsPerOperation = 500;

    private readonly IFileStorage storage = storageFactory.Get(FileStorageDestination.Brands);

    public async Task<IReadOnlyList<BrandDto>> GetAllAsync(string? search, CancellationToken cancellationToken)
    {
        var brands = await brandRepository.GetAllAsync(search, cancellationToken);
        var counts = await brandRepository.GetProductCountsAsync(cancellationToken);

        return brands.Select(brand => MapToDto(brand, counts.GetValueOrDefault(brand.Id))).ToList();
    }

    public async Task<BrandDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var brand = await RequireAsync(id, cancellationToken);

        return await MapWithCountAsync(brand, cancellationToken);
    }

    public async Task<BrandDto> CreateAsync(CreateBrandRequest request, CancellationToken cancellationToken)
    {
        var name = await ValidateNameAsync(request.Name, null, cancellationToken);
        var slug = await ResolveSlugAsync(request.Slug, name, null, cancellationToken);
        var now = DateTime.UtcNow;

        var brand = new Brand
        {
            Name = name,
            Slug = slug,
            Description = NormalizeDescription(request.Description),
            IsFeatured = request.IsFeatured,
            SortOrder = ValidateSortOrder(request.SortOrder),
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        await brandRepository.AddAsync(brand, cancellationToken);
        await brandRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(brand, 0);
    }

    public async Task<BrandDto> UpdateAsync(int id, UpdateBrandRequest request, CancellationToken cancellationToken)
    {
        var brand = await RequireAsync(id, cancellationToken);
        var name = await ValidateNameAsync(request.Name, id, cancellationToken);

        brand.Name = name;
        brand.Slug = await ResolveSlugAsync(request.Slug, name, id, cancellationToken);
        brand.Description = NormalizeDescription(request.Description);
        brand.IsFeatured = request.IsFeatured;
        brand.SortOrder = ValidateSortOrder(request.SortOrder);
        brand.IsActive = request.IsActive;
        brand.UpdatedAt = DateTime.UtcNow;

        await brandRepository.SaveChangesAsync(cancellationToken);

        return await MapWithCountAsync(brand, cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var brand = await RequireAsync(id, cancellationToken);

        // La relación Product -> Brand es Restrict: con productos, la marca se desactiva.
        if (await brandRepository.HasProductsAsync(id, cancellationToken))
        {
            throw new InvalidOperationException("La marca tiene productos: desactívala en lugar de eliminarla, o quítale primero sus productos.");
        }

        var logo = brand.LogoUrl;
        brandRepository.Delete(brand);
        await brandRepository.SaveChangesAsync(cancellationToken);
        await CleanupAsync(logo);
    }

    public async Task<BrandDto> UploadLogoAsync(int id, Stream content, long length, CancellationToken cancellationToken)
    {
        var brand = await RequireAsync(id, cancellationToken);

        if (length <= 0 || length > BrandLogoRules.MaxBytes)
        {
            throw new ArgumentException("El logo debe pesar entre 1 byte y 1 MB.");
        }

        using var buffer = new MemoryStream();
        // Acota la memoria aunque el cliente informe mal el tamaño.
        var chunk = new byte[81920];
        int count;
        while ((count = await content.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (buffer.Length + count > BrandLogoRules.MaxBytes)
            {
                throw new ArgumentException("El logo supera 1 MB.");
            }

            await buffer.WriteAsync(chunk.AsMemory(0, count), cancellationToken);
        }

        var format = BrandLogoRules.Detect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
        buffer.Position = 0;

        var previous = brand.LogoUrl;
        var previousUpdatedAt = brand.UpdatedAt;
        var url = await storage.SaveAsync($"brands/{id}/{Guid.NewGuid():N}{format.Extension}", buffer, format.ContentType, cancellationToken);

        brand.LogoUrl = url;
        brand.UpdatedAt = DateTime.UtcNow;

        try
        {
            await brandRepository.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // La base no cambió: el archivo nuevo sobra y la marca conserva su logo.
            brand.LogoUrl = previous;
            brand.UpdatedAt = previousUpdatedAt;
            await CleanupAsync(url);
            throw;
        }

        // Un solo logo por marca: el anterior se borra del almacenamiento.
        await CleanupAsync(previous);

        return await MapWithCountAsync(brand, cancellationToken);
    }

    public async Task<BrandDto> DeleteLogoAsync(int id, CancellationToken cancellationToken)
    {
        var brand = await RequireAsync(id, cancellationToken);
        var previous = brand.LogoUrl;

        if (previous is not null)
        {
            brand.LogoUrl = null;
            brand.UpdatedAt = DateTime.UtcNow;
            await brandRepository.SaveChangesAsync(cancellationToken);
            await CleanupAsync(previous);
        }

        return await MapWithCountAsync(brand, cancellationToken);
    }

    public async Task<BrandProductsPageDto> GetProductsAsync(
        int id,
        BrandProductScope scope,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        await RequireAsync(id, cancellationToken);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var (items, total) = await brandRepository.GetProductsPageAsync(id, scope, search?.Trim(), page, pageSize, cancellationToken);

        return new BrandProductsPageDto
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items.Select(product => new BrandProductItemDto
            {
                Id = product.Id,
                Reference = product.Reference,
                Name = product.Name,
                IsActive = product.IsActive,
                MainImageUrl = product.Images
                    .Where(image => image.IsActive && image.ProductVariantId is null)
                    .OrderByDescending(image => image.IsMain)
                    .ThenBy(image => image.DisplayOrder)
                    .Select(image => image.Url)
                    .FirstOrDefault(),
                BrandId = product.BrandId,
                BrandName = product.Brand?.Name
            }).ToList()
        };
    }

    public async Task<BrandAssignmentResultDto> AssignProductsAsync(
        int id,
        AssignBrandProductsRequest request,
        CancellationToken cancellationToken)
    {
        var brand = await RequireAsync(id, cancellationToken);
        var products = await LoadProductsAsync(request.ProductIds, cancellationToken);

        var conflicts = products
            .Where(product => product.BrandId.HasValue && product.BrandId != brand.Id)
            .Select(product => new BrandAssignmentConflictDto
            {
                ProductId = product.Id,
                Reference = product.Reference,
                Name = product.Name,
                CurrentBrandId = product.BrandId!.Value,
                CurrentBrandName = product.Brand?.Name ?? string.Empty
            })
            .OrderBy(conflict => conflict.Reference)
            .ToList();

        // Nunca se mueve un producto de otra marca sin que la persona lo confirme.
        if (conflicts.Count > 0 && !request.MoveFromOtherBrands)
        {
            throw new BrandAssignmentConflictException(conflicts);
        }

        var now = DateTime.UtcNow;
        var updated = 0;

        foreach (var product in products.Where(product => product.BrandId != brand.Id))
        {
            // Una sola columna: asignar reemplaza la marca anterior.
            product.BrandId = brand.Id;
            product.UpdatedAt = now;
            updated++;
        }

        await brandRepository.SaveChangesAsync(cancellationToken);

        return new BrandAssignmentResultDto { UpdatedCount = updated };
    }

    public async Task<BrandAssignmentResultDto> RemoveProductsAsync(
        RemoveBrandProductsRequest request,
        CancellationToken cancellationToken)
    {
        var products = await LoadProductsAsync(request.ProductIds, cancellationToken);
        var now = DateTime.UtcNow;
        var updated = 0;

        foreach (var product in products.Where(product => product.BrandId.HasValue))
        {
            product.BrandId = null;
            product.UpdatedAt = now;
            updated++;
        }

        await brandRepository.SaveChangesAsync(cancellationToken);

        return new BrandAssignmentResultDto { UpdatedCount = updated };
    }

    private async Task<IReadOnlyList<Product>> LoadProductsAsync(IEnumerable<int>? productIds, CancellationToken cancellationToken)
    {
        var ids = (productIds ?? []).Where(productId => productId > 0).Distinct().ToList();

        if (ids.Count == 0)
        {
            throw new ArgumentException("Selecciona al menos un producto.");
        }

        if (ids.Count > MaxProductsPerOperation)
        {
            throw new ArgumentException($"Se pueden actualizar como máximo {MaxProductsPerOperation} productos a la vez.");
        }

        var products = await brandRepository.GetProductsByIdsAsync(ids, cancellationToken);

        if (products.Count != ids.Count)
        {
            throw new KeyNotFoundException("Alguno de los productos no existe.");
        }

        return products;
    }

    private async Task<Brand> RequireAsync(int id, CancellationToken cancellationToken) =>
        await brandRepository.GetByIdAsync(id, cancellationToken) ?? throw new KeyNotFoundException("La marca no existe.");

    /// <summary>
    /// Nombre obligatorio y único sin importar tildes, mayúsculas, espacios ni signos:
    /// "PÚRPURE" no puede crearse si ya existe "Purpure".
    /// </summary>
    private async Task<string> ValidateNameAsync(string? rawName, int? excludedId, CancellationToken cancellationToken)
    {
        var name = Slugs.CleanName(rawName);

        if (name.Length == 0)
        {
            throw new ArgumentException("El nombre de la marca es obligatorio.");
        }

        if (name.Length > 150)
        {
            throw new ArgumentException("El nombre de la marca admite como máximo 150 caracteres.");
        }

        var key = Slugs.NameKey(name);

        if (key.Length == 0)
        {
            throw new ArgumentException("El nombre de la marca debe tener letras o números.");
        }

        var duplicate = (await brandRepository.GetAllAsync(null, cancellationToken))
            .FirstOrDefault(brand => brand.Id != excludedId && Slugs.NameKey(brand.Name) == key);

        if (duplicate is not null)
        {
            throw new InvalidOperationException($"Ya existe la marca \"{duplicate.Name}\" con ese nombre.");
        }

        return name;
    }

    /// <summary>
    /// Slug escrito por la persona (se valida y debe estar libre) o, si viene vacío,
    /// generado desde el nombre y con sufijo -2, -3… si ya existe.
    /// </summary>
    private async Task<string> ResolveSlugAsync(string? requested, string name, int? excludedId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var slug = requested.Trim().ToLowerInvariant();

            if (!Slugs.IsValid(slug))
            {
                throw new ArgumentException("La URL solo admite minúsculas, números y guiones (por ejemplo: dear-body).");
            }

            if (await brandRepository.IsSlugTakenAsync(slug, excludedId, cancellationToken))
            {
                throw new InvalidOperationException($"La URL \"{slug}\" ya la usa otra marca.");
            }

            return slug;
        }

        var generated = Slugs.From(name);
        var taken = (await brandRepository.GetAllAsync(null, cancellationToken))
            .Where(brand => brand.Id != excludedId)
            .Select(brand => brand.Slug)
            .ToHashSet(StringComparer.Ordinal);

        return Slugs.MakeUnique(generated, taken.Contains);
    }

    private static string? NormalizeDescription(string? description)
    {
        var text = description?.Trim();

        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        if (text.Length > MaxDescriptionLength)
        {
            throw new ArgumentException($"La descripción admite como máximo {MaxDescriptionLength} caracteres.");
        }

        return text;
    }

    private static int ValidateSortOrder(int sortOrder) =>
        sortOrder < 0 ? throw new ArgumentException("El orden no puede ser negativo.") : sortOrder;

    private async Task<BrandDto> MapWithCountAsync(Brand brand, CancellationToken cancellationToken)
    {
        var counts = await brandRepository.GetProductCountsAsync(cancellationToken);
        return MapToDto(brand, counts.GetValueOrDefault(brand.Id));
    }

    private async Task CleanupAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            await storage.DeleteByUrlAsync(url, CancellationToken.None);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "No se pudo borrar el logo {LogoUrl}; requiere limpieza manual.", url);
        }
    }

    private static BrandDto MapToDto(Brand brand, int productCount) => new()
    {
        Id = brand.Id,
        Name = brand.Name,
        Slug = brand.Slug,
        LogoUrl = brand.LogoUrl,
        Description = brand.Description,
        IsFeatured = brand.IsFeatured,
        SortOrder = brand.SortOrder,
        IsActive = brand.IsActive,
        ProductCount = productCount,
        CreatedAt = brand.CreatedAt,
        UpdatedAt = brand.UpdatedAt
    };
}
