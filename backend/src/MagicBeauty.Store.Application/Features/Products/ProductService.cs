using System.Text.RegularExpressions;

using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.Products.Requests;
using MagicBeauty.Store.Contracts.Products.Responses;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Domain.Enums;

namespace MagicBeauty.Store.Application.Features.Products;

public sealed partial class ProductService(
    IProductRepository productRepository,
    IBrandRepository brandRepository,
    ICategoryRepository categoryRepository,
    IPriceTypeRepository priceTypeRepository) : IProductService
{
    /// <summary>
    /// Nombre de la variante interna de los productos sin tonos. Nunca se muestra
    /// al consumidor: existe solo para que el inventario tenga un unico modelo.
    /// </summary>
    private const string DefaultVariantName = "DEFAULT";

    /// <summary>
    /// Codigos publicos de los movimientos. El enum se persiste con su propio nombre;
    /// esta tabla traduce entre el contrato del API y el dominio.
    /// </summary>
    private static readonly Dictionary<string, InventoryMovementType> MovementTypesByCode =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["INITIAL"] = InventoryMovementType.Initial,
            ["IN"] = InventoryMovementType.In,
            ["SALE_ONLINE"] = InventoryMovementType.SaleOnline,
            ["SALE_PHYSICAL"] = InventoryMovementType.SalePhysical,
            ["ADJUSTMENT"] = InventoryMovementType.Adjustment
        };

    [GeneratedRegex("^[A-Z]{3}[0-9]{3}$")]
    private static partial Regex ReferencePattern();

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorHexPattern();

    public async Task<IReadOnlyList<ProductListItemDto>> GetAllAsync(
        int? brandId,
        int? categoryId,
        bool? isActive,
        string? search,
        CancellationToken cancellationToken)
    {
        var products = await productRepository.GetAllAsync(
            brandId,
            categoryId,
            isActive,
            Normalize(search),
            cancellationToken);

        return products.Select(MapToListItemDto).ToList();
    }

    public async Task<ProductDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var product = await productRepository.GetDetailByIdAsync(id, cancellationToken);

        if (product is null)
        {
            throw new KeyNotFoundException("El producto no existe.");
        }

        return MapToDto(product);
    }

    public async Task<ProductDto> GetByReferenceAsync(string reference, CancellationToken cancellationToken)
    {
        var product = await productRepository.GetDetailByReferenceAsync(
            NormalizeReference(reference),
            cancellationToken);

        if (product is null)
        {
            throw new KeyNotFoundException("El producto no existe.");
        }

        return MapToDto(product);
    }

    public async Task<ProductDetailDto> GetPublicDetailAsync(
        string reference,
        CancellationToken cancellationToken)
    {
        var product = await productRepository.GetDetailByReferenceAsync(
            NormalizeReference(reference),
            cancellationToken);

        // Un producto desactivado no existe para la tienda.
        if (product is null || !product.IsActive)
        {
            throw new KeyNotFoundException("El producto no existe.");
        }

        var activeVariants = product.Variants
            .Where(variant => variant.IsActive)
            .OrderBy(variant => variant.DisplayOrder)
            .ThenBy(variant => variant.Name)
            .ToList();

        var defaultPrice = product.Prices
            .FirstOrDefault(price => price.IsActive && price.PriceType is not null && price.PriceType.IsDefault);

        return new ProductDetailDto
        {
            Id = product.Id,
            Reference = product.Reference,
            Name = product.Name,
            Description = product.Description,
            BrandName = product.Brand?.Name ?? string.Empty,
            Price = defaultPrice?.Amount,
            HasVariants = product.HasVariants,
            AvailableQuantity = activeVariants.Sum(variant => variant.Quantity),
            Categories = product.ProductCategories
                .Where(link => link.Category is not null)
                .Select(link => new ProductDetailCategoryDto
                {
                    Id = link.CategoryId,
                    Name = link.Category!.Name,
                    Slug = link.Category.Slug
                })
                .OrderBy(category => category.Name)
                .ToList(),
            Images = product.Images
                .Where(image => image.IsActive)
                .OrderByDescending(image => image.IsMain)
                .ThenBy(image => image.DisplayOrder)
                .Select(image => new ProductDetailImageDto
                {
                    Id = image.Id,
                    ProductVariantId = image.ProductVariantId,
                    Url = image.Url,
                    AltText = image.AltText,
                    DisplayOrder = image.DisplayOrder,
                    IsMain = image.IsMain
                })
                .ToList(),
            // La variante interna nunca se expone: solo existe para el inventario.
            Variants = product.HasVariants
                ? activeVariants
                    .Where(variant => !variant.IsDefault)
                    .Select(variant => new ProductDetailVariantDto
                    {
                        Id = variant.Id,
                        Name = variant.Name,
                        Code = variant.Code,
                        ColorHex = variant.ColorHex,
                        Quantity = variant.Quantity,
                        DisplayOrder = variant.DisplayOrder
                    })
                    .ToList()
                : []
        };
    }

    public async Task<ProductDto> CreateAsync(
        CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var reference = NormalizeReference(request.Reference);
        var name = RequireText(request.Name, "El nombre del producto es obligatorio.");

        if (await productRepository.ExistsByReferenceAsync(reference, cancellationToken))
        {
            throw new InvalidOperationException("Ya existe un producto con la referencia " + reference + ".");
        }

        await EnsureBrandExistsAsync(request.BrandId, cancellationToken);

        var categoryIds = await ValidateCategoriesAsync(request.CategoryIds, cancellationToken);
        var prices = await ValidatePricesAsync(request.Prices, cancellationToken);

        var now = DateTime.UtcNow;

        var product = new Product
        {
            Reference = reference,
            Name = name,
            Description = Normalize(request.Description),
            BrandId = request.BrandId,
            HasVariants = request.HasVariants,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var categoryId in categoryIds)
        {
            product.ProductCategories.Add(new ProductCategory { CategoryId = categoryId });
        }

        foreach (var price in prices)
        {
            product.Prices.Add(new ProductPrice
            {
                PriceTypeId = price.PriceTypeId,
                Amount = price.Amount,
                IsActive = price.IsActive,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        if (request.HasVariants)
        {
            if (request.Variants.Count == 0)
            {
                throw new InvalidOperationException(
                    "Un producto con tonos necesita al menos una variante.");
            }

            foreach (var variant in request.Variants)
            {
                product.Variants.Add(BuildVariant(
                    RequireText(variant.Name, "El nombre de la variante es obligatorio."),
                    Normalize(variant.Code),
                    NormalizeColorHex(variant.ColorHex),
                    variant.Quantity,
                    variant.DisplayOrder,
                    isDefault: false,
                    now));
            }
        }
        else
        {
            if (request.Variants.Count > 0)
            {
                throw new InvalidOperationException(
                    "Un producto sin tonos no admite variantes: usa InitialQuantity para sus existencias.");
            }

            product.Variants.Add(BuildVariant(
                DefaultVariantName,
                code: null,
                colorHex: null,
                request.InitialQuantity,
                displayOrder: 0,
                isDefault: true,
                now));
        }

        await productRepository.AddAsync(product, cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(product.Id, cancellationToken);
    }

    public async Task UpdateAsync(
        int id,
        UpdateProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await RequireProductAsync(id, cancellationToken);

        var name = RequireText(request.Name, "El nombre del producto es obligatorio.");

        await EnsureBrandExistsAsync(request.BrandId, cancellationToken);

        // Reference y HasVariants no se tocan: cambiarlos romperia la trazabilidad
        // y el modelo de inventario ya creado.
        product.Name = name;
        product.Description = Normalize(request.Description);
        product.BrandId = request.BrandId;
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var product = await RequireProductAsync(id, cancellationToken);

        // Desactivacion logica: el producto conserva su historico de inventario.
        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task SetCategoriesAsync(
        int id,
        SetProductCategoriesRequest request,
        CancellationToken cancellationToken)
    {
        var product = await RequireProductAsync(id, cancellationToken);

        var categoryIds = await ValidateCategoriesAsync(request.CategoryIds, cancellationToken);
        var current = await productRepository.GetCategoryLinksAsync(id, cancellationToken);

        productRepository.RemoveCategoryLinks(current);

        foreach (var categoryId in categoryIds)
        {
            product.ProductCategories.Add(new ProductCategory
            {
                ProductId = id,
                CategoryId = categoryId
            });
        }

        product.UpdatedAt = DateTime.UtcNow;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task SetPricesAsync(
        int id,
        SetProductPricesRequest request,
        CancellationToken cancellationToken)
    {
        var product = await RequireProductAsync(id, cancellationToken);

        var prices = await ValidatePricesAsync(request.Prices, cancellationToken);
        var current = await productRepository.GetPricesAsync(id, cancellationToken);

        productRepository.RemovePrices(current);

        var now = DateTime.UtcNow;

        foreach (var price in prices)
        {
            product.Prices.Add(new ProductPrice
            {
                ProductId = id,
                PriceTypeId = price.PriceTypeId,
                Amount = price.Amount,
                IsActive = price.IsActive,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        product.UpdatedAt = now;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProductVariantDto>> GetVariantsAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        await RequireProductAsync(productId, cancellationToken);

        var variants = await productRepository.GetVariantsAsync(productId, cancellationToken);

        return variants.Select(MapToVariantDto).ToList();
    }

    public async Task<ProductVariantDto> AddVariantAsync(
        int productId,
        CreateProductVariantRequest request,
        CancellationToken cancellationToken)
    {
        var product = await RequireProductAsync(productId, cancellationToken);

        if (!product.HasVariants)
        {
            throw new InvalidOperationException(
                "Este producto no maneja tonos: su inventario vive en la variante interna.");
        }

        var variant = BuildVariant(
            RequireText(request.Name, "El nombre de la variante es obligatorio."),
            Normalize(request.Code),
            NormalizeColorHex(request.ColorHex),
            request.Quantity,
            request.DisplayOrder,
            isDefault: false,
            DateTime.UtcNow);

        variant.ProductId = productId;

        await productRepository.AddVariantAsync(variant, cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);

        return MapToVariantDto(variant);
    }

    public async Task UpdateVariantAsync(
        int variantId,
        UpdateProductVariantRequest request,
        CancellationToken cancellationToken)
    {
        var variant = await RequireVariantAsync(variantId, cancellationToken);

        // Quantity no se toca aqui a proposito: solo cambia por AdjustInventoryAsync,
        // que ademas deja el movimiento registrado.
        variant.Name = RequireText(request.Name, "El nombre de la variante es obligatorio.");
        variant.Code = Normalize(request.Code);
        variant.ColorHex = NormalizeColorHex(request.ColorHex);
        variant.DisplayOrder = request.DisplayOrder;
        variant.IsActive = request.IsActive;
        variant.UpdatedAt = DateTime.UtcNow;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteVariantAsync(int variantId, CancellationToken cancellationToken)
    {
        var variant = await RequireVariantAsync(variantId, cancellationToken);

        if (variant.IsDefault)
        {
            throw new InvalidOperationException(
                "La variante interna no se puede desactivar: es la que sostiene el inventario del producto.");
        }

        variant.IsActive = false;
        variant.UpdatedAt = DateTime.UtcNow;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<ProductVariantDto> AdjustInventoryAsync(
        int variantId,
        AdjustInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var variant = await RequireVariantAsync(variantId, cancellationToken);
        var type = ParseMovementType(request.Type);

        if (type == InventoryMovementType.Initial)
        {
            throw new InvalidOperationException(
                "El movimiento INITIAL solo lo genera el sistema al crear la variante.");
        }

        var delta = ResolveDelta(type, request.Quantity);
        var previousQuantity = variant.Quantity;
        var newQuantity = previousQuantity + delta;

        if (newQuantity < 0)
        {
            throw new InvalidOperationException(
                "No hay existencias suficientes: disponibles " + previousQuantity +
                ", solicitadas " + Math.Abs(delta) + ".");
        }

        var now = DateTime.UtcNow;

        variant.Quantity = newQuantity;
        variant.UpdatedAt = now;

        await productRepository.AddMovementAsync(
            new InventoryMovement
            {
                ProductVariantId = variantId,
                Type = type,
                Quantity = delta,
                PreviousQuantity = previousQuantity,
                NewQuantity = newQuantity,
                Reason = Normalize(request.Reason),
                CreatedAt = now
            },
            cancellationToken);

        await productRepository.SaveChangesAsync(cancellationToken);

        return MapToVariantDto(variant);
    }

    public async Task<IReadOnlyList<InventoryMovementDto>> GetMovementsAsync(
        int variantId,
        CancellationToken cancellationToken)
    {
        await RequireVariantAsync(variantId, cancellationToken);

        var movements = await productRepository.GetMovementsAsync(variantId, cancellationToken);

        return movements
            .Select(movement => new InventoryMovementDto
            {
                Id = movement.Id,
                ProductVariantId = movement.ProductVariantId,
                Type = ToMovementCode(movement.Type),
                Quantity = movement.Quantity,
                PreviousQuantity = movement.PreviousQuantity,
                NewQuantity = movement.NewQuantity,
                Reason = movement.Reason,
                CreatedAt = movement.CreatedAt
            })
            .ToList();
    }

    public async Task<IReadOnlyList<ProductImageDto>> GetImagesAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        await RequireProductAsync(productId, cancellationToken);

        var images = await productRepository.GetImagesAsync(productId, cancellationToken);

        return images.Select(MapToImageDto).ToList();
    }

    public async Task<ProductImageDto> AddImageAsync(
        int productId,
        CreateProductImageRequest request,
        CancellationToken cancellationToken)
    {
        await RequireProductAsync(productId, cancellationToken);

        var url = RequireText(request.Url, "La URL de la imagen es obligatoria.");

        await EnsureVariantBelongsToProductAsync(request.ProductVariantId, productId, cancellationToken);

        if (request.IsMain)
        {
            await ClearMainImageAsync(productId, request.ProductVariantId, null, cancellationToken);
        }

        var now = DateTime.UtcNow;

        var image = new ProductImage
        {
            ProductId = productId,
            ProductVariantId = request.ProductVariantId,
            Url = url,
            AltText = Normalize(request.AltText),
            DisplayOrder = request.DisplayOrder,
            IsMain = request.IsMain,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        await productRepository.AddImageAsync(image, cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);

        return MapToImageDto(image);
    }

    public async Task UpdateImageAsync(
        int imageId,
        UpdateProductImageRequest request,
        CancellationToken cancellationToken)
    {
        var image = await productRepository.GetImageByIdAsync(imageId, cancellationToken);

        if (image is null)
        {
            throw new KeyNotFoundException("La imagen no existe.");
        }

        var url = RequireText(request.Url, "La URL de la imagen es obligatoria.");

        await EnsureVariantBelongsToProductAsync(
            request.ProductVariantId,
            image.ProductId,
            cancellationToken);

        if (request.IsMain)
        {
            await ClearMainImageAsync(
                image.ProductId,
                request.ProductVariantId,
                imageId,
                cancellationToken);
        }

        image.Url = url;
        image.AltText = Normalize(request.AltText);
        image.ProductVariantId = request.ProductVariantId;
        image.DisplayOrder = request.DisplayOrder;
        image.IsMain = request.IsMain;
        image.IsActive = request.IsActive;
        image.UpdatedAt = DateTime.UtcNow;

        await productRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteImageAsync(int imageId, CancellationToken cancellationToken)
    {
        var image = await productRepository.GetImageByIdAsync(imageId, cancellationToken);

        if (image is null)
        {
            throw new KeyNotFoundException("La imagen no existe.");
        }

        // Las imagenes no guardan historico, asi que aqui si aplica borrado fisico.
        productRepository.RemoveImage(image);
        await productRepository.SaveChangesAsync(cancellationToken);
    }

    private async Task<Product> RequireProductAsync(int id, CancellationToken cancellationToken)
    {
        var product = await productRepository.GetByIdAsync(id, cancellationToken);

        if (product is null)
        {
            throw new KeyNotFoundException("El producto no existe.");
        }

        return product;
    }

    private async Task<ProductVariant> RequireVariantAsync(
        int variantId,
        CancellationToken cancellationToken)
    {
        var variant = await productRepository.GetVariantByIdAsync(variantId, cancellationToken);

        if (variant is null)
        {
            throw new KeyNotFoundException("La variante no existe.");
        }

        return variant;
    }

    private async Task EnsureBrandExistsAsync(int brandId, CancellationToken cancellationToken)
    {
        if (await brandRepository.GetByIdAsync(brandId, cancellationToken) is null)
        {
            throw new InvalidOperationException("La marca no existe.");
        }
    }

    private async Task EnsureVariantBelongsToProductAsync(
        int? variantId,
        int productId,
        CancellationToken cancellationToken)
    {
        if (!variantId.HasValue)
        {
            return;
        }

        var variant = await productRepository.GetVariantByIdAsync(variantId.Value, cancellationToken);

        // La coherencia producto-variante no se puede expresar con un CHECK,
        // porque cruza dos tablas: se valida aqui.
        if (variant is null || variant.ProductId != productId)
        {
            throw new InvalidOperationException("La variante indicada no pertenece a este producto.");
        }
    }

    /// <summary>
    /// Deja una sola imagen principal por contexto: el producto o una variante concreta.
    /// </summary>
    private async Task ClearMainImageAsync(
        int productId,
        int? variantId,
        int? excludedImageId,
        CancellationToken cancellationToken)
    {
        var images = await productRepository.GetImagesAsync(productId, cancellationToken);

        foreach (var image in images)
        {
            if (image.IsMain &&
                image.ProductVariantId == variantId &&
                image.Id != excludedImageId)
            {
                image.IsMain = false;
                image.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private async Task<List<int>> ValidateCategoriesAsync(
        List<int> categoryIds,
        CancellationToken cancellationToken)
    {
        var distinct = categoryIds.Distinct().ToList();

        if (distinct.Count == 0)
        {
            return distinct;
        }

        var existing = await categoryRepository.GetExistingIdsAsync(distinct, cancellationToken);
        var missing = distinct.Except(existing).ToList();

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                "No existen las categorias: " + string.Join(", ", missing) + ".");
        }

        return distinct;
    }

    private async Task<List<UpsertProductPriceRequest>> ValidatePricesAsync(
        List<UpsertProductPriceRequest> prices,
        CancellationToken cancellationToken)
    {
        if (prices.Count == 0)
        {
            throw new ArgumentException("Debes indicar al menos un precio.");
        }

        var repeated = prices
            .GroupBy(price => price.PriceTypeId)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        if (repeated.Count > 0)
        {
            throw new InvalidOperationException(
                "Hay tipos de precio repetidos: " + string.Join(", ", repeated) + ".");
        }

        if (prices.Any(price => price.Amount < 0))
        {
            throw new ArgumentException("El precio no puede ser negativo.");
        }

        var ids = prices.Select(price => price.PriceTypeId).ToList();
        var existing = await priceTypeRepository.GetExistingIdsAsync(ids, cancellationToken);
        var missing = ids.Except(existing).ToList();

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                "No existen los tipos de precio: " + string.Join(", ", missing) + ".");
        }

        var defaultPriceType = await priceTypeRepository.GetDefaultAsync(cancellationToken);

        if (defaultPriceType is null)
        {
            throw new InvalidOperationException(
                "No hay un tipo de precio predeterminado configurado.");
        }

        // Sin el precio predeterminado el producto no tendria que mostrarle al cliente.
        if (prices.All(price => price.PriceTypeId != defaultPriceType.Id))
        {
            throw new InvalidOperationException(
                "Falta el precio " + defaultPriceType.Code + ", que es el que ve el cliente.");
        }

        return prices;
    }

    private static ProductVariant BuildVariant(
        string name,
        string? code,
        string? colorHex,
        int quantity,
        int displayOrder,
        bool isDefault,
        DateTime now)
    {
        if (quantity < 0)
        {
            throw new ArgumentException("La cantidad no puede ser negativa.");
        }

        var variant = new ProductVariant
        {
            Name = name,
            Code = code,
            ColorHex = colorHex,
            Quantity = quantity,
            DisplayOrder = displayOrder,
            IsDefault = isDefault,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        if (quantity > 0)
        {
            variant.Movements.Add(new InventoryMovement
            {
                Type = InventoryMovementType.Initial,
                Quantity = quantity,
                PreviousQuantity = 0,
                NewQuantity = quantity,
                Reason = "Carga inicial",
                CreatedAt = now
            });
        }

        return variant;
    }

    private static InventoryMovementType ParseMovementType(string type)
    {
        if (!MovementTypesByCode.TryGetValue(Normalize(type) ?? string.Empty, out var parsed))
        {
            // INITIAL se omite del mensaje: no es un tipo que el cliente pueda enviar.
            var allowed = MovementTypesByCode.Keys
                .Where(code => !string.Equals(code, "INITIAL", StringComparison.OrdinalIgnoreCase));

            throw new ArgumentException(
                "Tipo de movimiento no valido. Usa: " + string.Join(", ", allowed) + ".");
        }

        return parsed;
    }

    private static string ToMovementCode(InventoryMovementType type)
    {
        return type switch
        {
            InventoryMovementType.Initial => "INITIAL",
            InventoryMovementType.In => "IN",
            InventoryMovementType.SaleOnline => "SALE_ONLINE",
            InventoryMovementType.SalePhysical => "SALE_PHYSICAL",
            InventoryMovementType.Adjustment => "ADJUSTMENT",
            _ => type.ToString().ToUpperInvariant()
        };
    }

    /// <summary>
    /// Convierte la cantidad pedida en el delta con signo que se aplicara, de modo
    /// que siempre se cumpla PreviousQuantity + Quantity == NewQuantity.
    /// </summary>
    private static int ResolveDelta(InventoryMovementType type, int quantity)
    {
        if (type == InventoryMovementType.Adjustment)
        {
            if (quantity == 0)
            {
                throw new ArgumentException("Un ajuste debe mover una cantidad distinta de cero.");
            }

            return quantity;
        }

        if (quantity <= 0)
        {
            throw new ArgumentException("La cantidad del movimiento debe ser mayor que cero.");
        }

        return type == InventoryMovementType.In ? quantity : -quantity;
    }

    private static string NormalizeReference(string reference)
    {
        if (string.IsNullOrWhiteSpace(reference))
        {
            throw new ArgumentException("La referencia es obligatoria.");
        }

        var normalized = reference.Trim().ToUpperInvariant();

        if (!ReferencePattern().IsMatch(normalized))
        {
            throw new ArgumentException(
                "La referencia debe ser 3 letras seguidas de 3 numeros. Ejemplo: ABC123.");
        }

        return normalized;
    }

    private static string? NormalizeColorHex(string? colorHex)
    {
        var normalized = Normalize(colorHex);

        if (normalized is null)
        {
            return null;
        }

        if (!ColorHexPattern().IsMatch(normalized))
        {
            throw new ArgumentException("El color debe tener el formato #RRGGBB.");
        }

        return normalized.ToUpperInvariant();
    }

    private static string RequireText(string value, string message)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(message);
        }

        return value.Trim();
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static ProductListItemDto MapToListItemDto(Product product)
    {
        var defaultPrice = product.Prices
            .FirstOrDefault(price => price.IsActive && price.PriceType is not null && price.PriceType.IsDefault);

        return new ProductListItemDto
        {
            Id = product.Id,
            Reference = product.Reference,
            Name = product.Name,
            BrandId = product.BrandId,
            BrandName = product.Brand?.Name ?? string.Empty,
            HasVariants = product.HasVariants,
            IsActive = product.IsActive,
            TotalQuantity = product.Variants.Where(variant => variant.IsActive).Sum(variant => variant.Quantity),
            DefaultPrice = defaultPrice?.Amount,
            MainImageUrl = product.Images
                .Where(image => image.IsActive && image.IsMain && image.ProductVariantId is null)
                .Select(image => image.Url)
                .FirstOrDefault(),
            Categories = product.ProductCategories
                .Where(link => link.Category is not null)
                .Select(link => link.Category!.Name)
                .OrderBy(name => name)
                .ToList()
        };
    }

    private static ProductDto MapToDto(Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Reference = product.Reference,
            Name = product.Name,
            Description = product.Description,
            BrandId = product.BrandId,
            BrandName = product.Brand?.Name ?? string.Empty,
            HasVariants = product.HasVariants,
            IsActive = product.IsActive,
            CreatedAt = product.CreatedAt,
            UpdatedAt = product.UpdatedAt,
            Categories = product.ProductCategories
                .Where(link => link.Category is not null)
                .Select(link => new ProductCategoryDto
                {
                    CategoryId = link.CategoryId,
                    Name = link.Category!.Name,
                    Slug = link.Category.Slug
                })
                .OrderBy(category => category.Name)
                .ToList(),
            Prices = product.Prices
                .Select(price => new ProductPriceDto
                {
                    Id = price.Id,
                    PriceTypeId = price.PriceTypeId,
                    PriceTypeCode = price.PriceType?.Code ?? string.Empty,
                    PriceTypeName = price.PriceType?.Name ?? string.Empty,
                    IsDefaultPriceType = price.PriceType?.IsDefault ?? false,
                    Amount = price.Amount,
                    IsActive = price.IsActive
                })
                .OrderByDescending(price => price.IsDefaultPriceType)
                .ThenBy(price => price.PriceTypeCode)
                .ToList(),
            Variants = product.Variants
                .OrderBy(variant => variant.DisplayOrder)
                .ThenBy(variant => variant.Name)
                .Select(MapToVariantDto)
                .ToList(),
            Images = product.Images
                .OrderBy(image => image.DisplayOrder)
                .Select(MapToImageDto)
                .ToList()
        };
    }

    private static ProductVariantDto MapToVariantDto(ProductVariant variant)
    {
        return new ProductVariantDto
        {
            Id = variant.Id,
            ProductId = variant.ProductId,
            Name = variant.Name,
            Code = variant.Code,
            ColorHex = variant.ColorHex,
            Quantity = variant.Quantity,
            DisplayOrder = variant.DisplayOrder,
            IsDefault = variant.IsDefault,
            IsActive = variant.IsActive,
            CreatedAt = variant.CreatedAt,
            UpdatedAt = variant.UpdatedAt
        };
    }

    private static ProductImageDto MapToImageDto(ProductImage image)
    {
        return new ProductImageDto
        {
            Id = image.Id,
            ProductId = image.ProductId,
            ProductVariantId = image.ProductVariantId,
            Url = image.Url,
            AltText = image.AltText,
            DisplayOrder = image.DisplayOrder,
            IsMain = image.IsMain,
            IsActive = image.IsActive
        };
    }
}
