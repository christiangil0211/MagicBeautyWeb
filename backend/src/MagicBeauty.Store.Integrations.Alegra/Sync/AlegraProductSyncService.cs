using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

using MagicBeauty.Store.Application.Features.Brands;
using MagicBeauty.Store.Application.Features.PriceTypes;
using MagicBeauty.Store.Application.Features.Products;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.PriceTypes.Responses;
using MagicBeauty.Store.Contracts.Products.Requests;
using MagicBeauty.Store.Contracts.Products.Responses;
using MagicBeauty.Store.Integrations.Alegra.Client;
using MagicBeauty.Store.Integrations.Alegra.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MagicBeauty.Store.Integrations.Alegra.Sync;

public interface IAlegraProductSyncService
{
    /// <summary>
    /// Trae los items de Alegra y actualiza (o crea) los productos de la tienda:
    /// nombre, descripcion, estado, precio e inventario.
    /// </summary>
    Task<AlegraProductSyncResult> SyncAsync(CancellationToken cancellationToken);
}

/// <summary>Ya hay una actualizacion en curso: no se lanzan dos a la vez.</summary>
public sealed class AlegraSyncInProgressException()
    : Exception("Ya hay una actualización desde Alegra en curso. Espera a que termine.");

/// <summary>Una sola actualizacion a la vez en esta instancia del API.</summary>
public sealed class AlegraSyncLock
{
    internal SemaphoreSlim Semaphore { get; } = new(1, 1);
}

/// <summary>
/// Sincronizacion bajo demanda (boton del administrador).
/// <list type="bullet">
/// <item>El cruce es por el <b>id de Alegra</b>, guardado en <c>alegra.ProductLinks</c>. La
/// referencia solo se usa la primera vez, para asociar un producto existente o crear uno nuevo.</item>
/// <item>El listado de la tienda permite comparar nombre, estado, existencias y precio
/// predeterminado: el detalle de un producto solo se carga si algo difiere.</item>
/// <item>Solo usa los servicios de Application, asi que respeta las mismas reglas que el
/// formulario de producto y deja los movimientos de inventario.</item>
/// <item>Cada producto se guarda por separado: un item con error no detiene a los demas.</item>
/// </list>
/// </summary>
public sealed partial class AlegraProductSyncService(
    IAlegraClient alegraClient,
    IProductService productService,
    IBrandService brandService,
    IPriceTypeService priceTypeService,
    AlegraDbContext linksDb,
    AlegraSyncLock syncLock,
    IOptions<AlegraOptions> options,
    ILogger<AlegraProductSyncService> logger) : IAlegraProductSyncService
{
    internal const string InventoryReason = "Sincronización con Alegra";
    internal const string AdjustmentType = "ADJUSTMENT";

    [GeneratedRegex("^[A-Z]{3}[0-9]{3}$")]
    private static partial Regex StoreReferencePattern();

    public async Task<AlegraProductSyncResult> SyncAsync(CancellationToken cancellationToken)
    {
        if (!await syncLock.Semaphore.WaitAsync(TimeSpan.Zero, cancellationToken))
        {
            throw new AlegraSyncInProgressException();
        }

        try
        {
            return await RunAsync(cancellationToken);
        }
        finally
        {
            syncLock.Semaphore.Release();
        }
    }

    private async Task<AlegraProductSyncResult> RunAsync(CancellationToken cancellationToken)
    {
        var result = new AlegraProductSyncResult { StartedAt = DateTime.UtcNow };
        var settings = options.Value;

        var items = await alegraClient.GetItemsAsync(cancellationToken);
        result.Total = items.Count;

        var priceType = await ResolvePriceTypeAsync(settings, result, cancellationToken);
        var catalog = new StoreCatalog(await productService.GetAllAsync(null, null, null, null, null, cancellationToken));
        var links = await LoadLinksAsync(catalog, cancellationToken);
        var seenIds = new HashSet<string>(StringComparer.Ordinal);
        int? brandId = null;

        try
        {
            foreach (var item in items)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var alegraId = item.Id?.Trim() ?? string.Empty;
                var reference = item.Reference?.Trim().ToUpperInvariant() ?? string.Empty;
                var name = item.Name?.Trim();
                var label = reference.Length > 0 ? reference : null;

                if (alegraId.Length == 0)
                {
                    Skip(result, label, name, "El ítem no tiene id en Alegra.");
                    continue;
                }

                if (!seenIds.Add(alegraId))
                {
                    Skip(result, label, name, "Alegra devolvió el mismo ítem dos veces; se tomó solo el primero.");
                    continue;
                }

                try
                {
                    if (links.ByAlegraId.TryGetValue(alegraId, out var link))
                    {
                        // Ya asociado: el id manda, aunque la referencia haya cambiado en Alegra.
                        await UpdateAndCountAsync(catalog.ById[link.ProductId], item, link, priceType, settings, result, cancellationToken);
                        continue;
                    }

                    // Primera vez que se ve este item: se asocia por referencia o se crea.
                    if (reference.Length == 0)
                    {
                        Skip(result, null, name, "No tiene referencia en Alegra: no se puede asociar ni crear.");
                        continue;
                    }

                    if (!StoreReferencePattern().IsMatch(reference))
                    {
                        Skip(result, reference, name, "La referencia no tiene el formato de la tienda (3 letras y 3 números).");
                        continue;
                    }

                    if (catalog.ByReference.TryGetValue(reference, out var existing))
                    {
                        if (links.ByProductId.TryGetValue(existing.Id, out var other))
                        {
                            Skip(result, reference, name,
                                $"El producto ya está asociado a otro ítem de Alegra (id {other.AlegraItemId}); revisa la referencia repetida en Alegra.");
                            continue;
                        }

                        var newLink = links.Add(existing.Id, alegraId);
                        result.Linked++;
                        await UpdateAndCountAsync(existing, item, newLink, priceType, settings, result, cancellationToken);
                        continue;
                    }

                    if (string.IsNullOrEmpty(name))
                    {
                        Skip(result, reference, name, "No tiene nombre en Alegra; no se puede crear el producto.");
                        continue;
                    }

                    brandId ??= await ResolveDefaultBrandAsync(settings, cancellationToken);
                    var created = await CreateAsync(reference, name, item, brandId.Value, priceType, settings, cancellationToken);
                    catalog.Add(created);
                    var createdLink = links.Add(created.Id, alegraId);
                    createdLink.DescriptionHash = DescriptionHash(item);
                    result.Created++;
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    result.Failed++;
                    result.Issues.Add(new AlegraSyncIssue
                    {
                        Kind = AlegraSyncIssue.Error,
                        Reference = label,
                        Name = name,
                        // Los errores de negocio traen un mensaje para el usuario; el resto no se expone.
                        Message = exception is ArgumentException or InvalidOperationException or KeyNotFoundException
                            ? exception.Message
                            : "No se pudo actualizar el producto."
                    });
                    logger.LogWarning(exception, "Alegra: no se pudo sincronizar el item {AlegraId} ({Reference})", alegraId, reference);
                }
            }
        }
        finally
        {
            // Los vinculos se guardan aunque la corrida se corte: los productos ya creados
            // quedan asociados y la siguiente corrida no los duplica.
            await linksDb.SaveChangesAsync(CancellationToken.None);
        }

        result.FinishedAt = DateTime.UtcNow;
        logger.LogInformation(
            "Alegra: {Total} items, {Created} creados, {Updated} actualizados, {Unchanged} sin cambios, {Linked} asociados, {Skipped} omitidos, {Failed} con error",
            result.Total, result.Created, result.Updated, result.Unchanged, result.Linked, result.Skipped, result.Failed);

        return result;
    }

    private async Task UpdateAndCountAsync(
        ProductListItemDto product,
        AlegraItem item,
        AlegraProductLink link,
        PriceTypeDto? priceType,
        AlegraOptions settings,
        AlegraProductSyncResult result,
        CancellationToken cancellationToken)
    {
        var changed = await UpdateAsync(product, item, link, priceType, settings, result, cancellationToken);
        link.LastSyncedAt = DateTime.UtcNow;

        if (changed) result.Updated++;
        else result.Unchanged++;
    }

    private async Task<bool> UpdateAsync(
        ProductListItemDto listed,
        AlegraItem item,
        AlegraProductLink link,
        PriceTypeDto? priceType,
        AlegraOptions settings,
        AlegraProductSyncResult result,
        CancellationToken cancellationToken)
    {
        var alegraName = string.IsNullOrWhiteSpace(item.Name) ? null : item.Name.Trim();
        var descriptionHash = DescriptionHash(item);
        var amount = AlegraPrice(item, settings);
        var quantity = AlegraQuantity(item);

        if (quantity is not null && listed.HasVariants)
        {
            result.Issues.Add(new AlegraSyncIssue
            {
                Kind = AlegraSyncIssue.Warning,
                Reference = listed.Reference,
                Name = listed.Name,
                Message = "Tiene tonos: el inventario se maneja por tono y no se actualizó desde Alegra."
            });
        }

        // Comparacion rapida contra el listado: si nada difiere no se carga el detalle.
        var mayDiffer =
            (alegraName is not null && alegraName != listed.Name)
            || item.IsActive != listed.IsActive
            || (quantity is not null && !listed.HasVariants && quantity != listed.TotalQuantity)
            // El listado solo trae el precio predeterminado: otro tipo de precio exige el detalle.
            || (priceType is not null && amount is not null && (!priceType.IsDefault || listed.DefaultPrice != amount))
            // La descripcion no esta en el listado: se mira si cambio en Alegra desde la ultima vez.
            || (descriptionHash is not null && descriptionHash != link.DescriptionHash);

        if (!mayDiffer)
        {
            return false;
        }

        var product = await productService.GetByIdAsync(listed.Id, cancellationToken);
        var changed = false;

        // Nombre y descripcion: solo si Alegra trae un valor, para no borrar lo de la tienda.
        var name = alegraName ?? product.Name;
        var description = string.IsNullOrWhiteSpace(item.Description) ? product.Description : item.Description.Trim();

        if (name != product.Name || description != product.Description || item.IsActive != product.IsActive)
        {
            await productService.UpdateAsync(product.Id, new UpdateProductRequest
            {
                Name = name,
                Description = description,
                BrandId = product.BrandId,
                IsActive = item.IsActive
            }, cancellationToken);
            changed = true;
        }

        if (priceType is not null && amount is not null)
        {
            var current = product.Prices.FirstOrDefault(price => price.PriceTypeId == priceType.Id);
            if (current is null || current.Amount != amount || !current.IsActive)
            {
                // SetPrices reemplaza la lista completa: se conservan los demas tipos de precio.
                var prices = product.Prices
                    .Where(price => price.PriceTypeId != priceType.Id)
                    .Select(price => new UpsertProductPriceRequest
                    {
                        PriceTypeId = price.PriceTypeId,
                        Amount = price.Amount,
                        IsActive = price.IsActive
                    })
                    .Append(new UpsertProductPriceRequest { PriceTypeId = priceType.Id, Amount = amount.Value })
                    .ToList();

                await productService.SetPricesAsync(product.Id, new SetProductPricesRequest { Prices = prices }, cancellationToken);
                changed = true;
            }
        }

        if (quantity is not null && !product.HasVariants)
        {
            var variant = product.Variants.FirstOrDefault(variant => variant.IsDefault) ?? product.Variants.FirstOrDefault();
            if (variant is not null && variant.Quantity != quantity)
            {
                await productService.AdjustInventoryAsync(variant.Id, new AdjustInventoryRequest
                {
                    Type = AdjustmentType,
                    Quantity = quantity.Value - variant.Quantity,
                    Reason = InventoryReason
                }, cancellationToken);
                changed = true;
            }
        }

        link.DescriptionHash = descriptionHash ?? link.DescriptionHash;
        return changed;
    }

    private async Task<ProductDto> CreateAsync(
        string reference,
        string name,
        AlegraItem item,
        int brandId,
        PriceTypeDto? priceType,
        AlegraOptions settings,
        CancellationToken cancellationToken)
    {
        var amount = AlegraPrice(item, settings);

        return await productService.CreateAsync(new CreateProductRequest
        {
            Reference = reference,
            Name = name,
            Description = string.IsNullOrWhiteSpace(item.Description) ? null : item.Description.Trim(),
            BrandId = brandId,
            HasVariants = false,
            // Nace inactivo: el administrador le pone categorias e imagenes y lo publica.
            IsActive = false,
            InitialQuantity = AlegraQuantity(item) ?? 0,
            Prices = priceType is not null && amount is not null
                ? [new UpsertProductPriceRequest { PriceTypeId = priceType.Id, Amount = amount.Value }]
                : []
        }, cancellationToken);
    }

    /// <summary>Vinculos guardados; los de productos que ya no existen se descartan.</summary>
    private async Task<LinkIndex> LoadLinksAsync(StoreCatalog catalog, CancellationToken cancellationToken)
    {
        var stored = await linksDb.ProductLinks.ToListAsync(cancellationToken);
        var orphans = stored.Where(link => !catalog.ById.ContainsKey(link.ProductId)).ToList();

        // El producto se borro en la tienda: si vuelve a llegar de Alegra se asocia o se crea de nuevo.
        linksDb.ProductLinks.RemoveRange(orphans);

        return new LinkIndex(linksDb, stored.Except(orphans));
    }

    private async Task<PriceTypeDto?> ResolvePriceTypeAsync(
        AlegraOptions settings,
        AlegraProductSyncResult result,
        CancellationToken cancellationToken)
    {
        var priceTypes = await priceTypeService.GetAllAsync(cancellationToken);
        var priceType = string.IsNullOrWhiteSpace(settings.PriceTypeCode)
            ? priceTypes.FirstOrDefault(type => type.IsDefault)
            : priceTypes.FirstOrDefault(type => string.Equals(type.Code, settings.PriceTypeCode.Trim(), StringComparison.OrdinalIgnoreCase));

        if (priceType is null)
        {
            result.Issues.Add(new AlegraSyncIssue
            {
                Kind = AlegraSyncIssue.Warning,
                Message = "No se encontró el tipo de precio configurado para Alegra: los precios no se actualizaron."
            });
        }

        return priceType;
    }

    private async Task<int> ResolveDefaultBrandAsync(AlegraOptions settings, CancellationToken cancellationToken)
    {
        var name = string.IsNullOrWhiteSpace(settings.DefaultBrandName) ? "Sin marca" : settings.DefaultBrandName.Trim();
        var brand = (await brandService.GetAllAsync(cancellationToken))
            .FirstOrDefault(brand => string.Equals(brand.Name, name, StringComparison.OrdinalIgnoreCase));

        return brand?.Id ?? (await brandService.CreateAsync(new CreateBrandRequest { Name = name }, cancellationToken)).Id;
    }

    /// <summary>Precio de la lista configurada; null si Alegra no lo trae o no es positivo.</summary>
    private static decimal? AlegraPrice(AlegraItem item, AlegraOptions settings)
    {
        var listId = settings.PriceListId.ToString(System.Globalization.CultureInfo.InvariantCulture);
        var amount = item.Price.FirstOrDefault(price => price.IdPriceList == listId)?.Price;

        return amount > 0 ? decimal.Round(amount.Value, 2) : null;
    }

    /// <summary>Existencias enteras y no negativas; null si el item no maneja inventario.</summary>
    private static int? AlegraQuantity(AlegraItem item) =>
        item.Inventory?.AvailableQuantity is { } quantity
            ? (int)Math.Floor(Math.Max(0, quantity))
            : null;

    /// <summary>Huella (SHA-256) de la descripcion de Alegra; null si viene vacia.</summary>
    private static string? DescriptionHash(AlegraItem item) =>
        string.IsNullOrWhiteSpace(item.Description)
            ? null
            : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(item.Description.Trim())));

    private static void Skip(AlegraProductSyncResult result, string? reference, string? name, string message)
    {
        result.Skipped++;
        result.Issues.Add(new AlegraSyncIssue { Kind = AlegraSyncIssue.Skipped, Reference = reference, Name = name, Message = message });
    }

    /// <summary>Productos de la tienda por id y por referencia (una sola consulta).</summary>
    private sealed class StoreCatalog
    {
        public StoreCatalog(IEnumerable<ProductListItemDto> products)
        {
            foreach (var product in products) Add(product);
        }

        public Dictionary<int, ProductListItemDto> ById { get; } = [];

        public Dictionary<string, ProductListItemDto> ByReference { get; } = new(StringComparer.OrdinalIgnoreCase);

        public void Add(ProductListItemDto product)
        {
            ById[product.Id] = product;
            ByReference[product.Reference] = product;
        }

        public void Add(ProductDto created) => Add(new ProductListItemDto
        {
            Id = created.Id,
            Reference = created.Reference,
            Name = created.Name,
            BrandId = created.BrandId,
            HasVariants = created.HasVariants,
            IsActive = created.IsActive
        });
    }

    /// <summary>Vinculos en memoria, en ambos sentidos; los nuevos se agregan al contexto.</summary>
    private sealed class LinkIndex
    {
        private readonly AlegraDbContext db;

        public LinkIndex(AlegraDbContext db, IEnumerable<AlegraProductLink> links)
        {
            this.db = db;
            foreach (var link in links) Index(link);
        }

        public Dictionary<string, AlegraProductLink> ByAlegraId { get; } = new(StringComparer.Ordinal);

        public Dictionary<int, AlegraProductLink> ByProductId { get; } = [];

        public AlegraProductLink Add(int productId, string alegraId)
        {
            var now = DateTime.UtcNow;
            var link = new AlegraProductLink { ProductId = productId, AlegraItemId = alegraId, LinkedAt = now, LastSyncedAt = now };
            db.ProductLinks.Add(link);
            Index(link);
            return link;
        }

        private void Index(AlegraProductLink link)
        {
            ByAlegraId[link.AlegraItemId] = link;
            ByProductId[link.ProductId] = link;
        }
    }
}
