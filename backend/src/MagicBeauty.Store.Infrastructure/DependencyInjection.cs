using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Infrastructure.Services;
using MagicBeauty.Store.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        bool isDevelopment)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<MagicBeautyDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddScoped<IBrandRepository, BrandRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IPriceTypeRepository, PriceTypeRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ITraditionalCatalogRepository, TraditionalCatalogRepository>();
        services.AddScoped<IUserRepository, UserRepository>();

        services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
        services.AddSingleton<ICanvaLinkInspector, CanvaLinkInspector>();
        AddEmailSender(services, configuration, isDevelopment);
        AddFileStorage(services, configuration, isDevelopment);

        return services;
    }

    /// <summary>
    /// Azure Blob Storage si esta configurado; si no, en Development disco local
    /// (fuera del repositorio) y en otros ambientes un error explicito al subir.
    /// </summary>
    private static void AddFileStorage(
        IServiceCollection services,
        IConfiguration configuration,
        bool isDevelopment)
    {
        var azure = configuration.GetSection(AzureBlobStorageOptions.SectionName).Get<AzureBlobStorageOptions>()
            ?? new AzureBlobStorageOptions();

        services.AddSingleton<IFileStorageFactory>(provider => new FileStorageFactory(
            provider.GetRequiredService<IFileStorage>(), azure,
            provider.GetService<LocalFileStorageOptions>(), provider.GetRequiredService<ILogger<AzureBlobFileStorage>>()));

        if (azure.IsConfigured)
        {
            services.AddSingleton(azure);
            services.AddSingleton<IFileStorage, AzureBlobFileStorage>();
        }
        else if (isDevelopment)
        {
            var local = configuration.GetSection(LocalFileStorageOptions.SectionName).Get<LocalFileStorageOptions>()
                ?? new LocalFileStorageOptions();

            // La capa web la usa para servir la carpeta en RequestPath.
            services.AddSingleton(local);
            services.AddSingleton<IFileStorage, LocalFileStorage>();
        }
        else
        {
            services.AddSingleton<IFileStorage, UnconfiguredFileStorage>();
        }
    }

    /// <summary>
    /// SMTP si esta configurado; si no, en Development el correo se deja en el log y
    /// en una carpeta local, y en otros ambientes el envio falla de forma explicita.
    /// </summary>
    private static void AddEmailSender(
        IServiceCollection services,
        IConfiguration configuration,
        bool isDevelopment)
    {
        var smtp = configuration.GetSection(SmtpEmailOptions.SectionName).Get<SmtpEmailOptions>()
            ?? new SmtpEmailOptions();

        if (smtp.IsConfigured)
        {
            services.AddSingleton(smtp);
            services.AddSingleton<IEmailSender, SmtpEmailSender>();
        }
        else if (isDevelopment)
        {
            var outputDirectory = configuration["Email:DevelopmentOutputDirectory"]
                ?? Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "MagicBeauty",
                    "dev-mail");

            services.AddSingleton<IEmailSender>(provider => new DevelopmentEmailSender(
                provider.GetRequiredService<ILogger<DevelopmentEmailSender>>(),
                outputDirectory));
        }
        else
        {
            services.AddSingleton<IEmailSender, UnconfiguredEmailSender>();
        }
    }
}