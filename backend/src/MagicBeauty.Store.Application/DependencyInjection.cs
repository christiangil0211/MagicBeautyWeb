using MagicBeauty.Store.Application.Features.Brands;
using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Application.Features.PriceTypes;
using MagicBeauty.Store.Application.Features.Products;
using Microsoft.Extensions.DependencyInjection;

namespace MagicBeauty.Store.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IBrandService, BrandService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IPriceTypeService, PriceTypeService>();
        services.AddScoped<IProductService, ProductService>();

        return services;
    }
}