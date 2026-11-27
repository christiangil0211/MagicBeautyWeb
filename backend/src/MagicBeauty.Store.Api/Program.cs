using System.Threading.RateLimiting;

using MagicBeauty.Store.Api.Filters;
using MagicBeauty.Store.Api.Middleware;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Api.Services;
using MagicBeauty.Store.Application;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Infrastructure;
using MagicBeauty.Store.Integrations.Alegra;
using MagicBeauty.Store.Infrastructure.Storage;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "MagicBeautyCorsPolicy";

builder.Services.AddControllers();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<MagicBeauty.Store.Api.Sales.BestSellers>();
builder.Services.AddSingleton<MagicBeauty.Store.Api.Sales.SalesImportQueue>();
builder.Services.AddHostedService<MagicBeauty.Store.Api.Sales.SalesImportWorker>();

// El catalogo publico pesa cientos de KB en JSON: comprimido (Brotli o gzip) baja a una fraccion.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ["application/json", "application/xml", "text/plain"];
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.IsDevelopment());

// Integracion Alegra (desmontable): ver MagicBeauty.Store.Integrations.Alegra.
builder.Services.AddAlegraIntegration(builder.Configuration);

builder.Services.AddStoreAuthentication(builder.Environment, builder.Configuration);

// Login, verificacion y cambio de contrasena terminan en 13 s como maximo.
builder.Services.AddAuthRequestBudget();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IPriceAudienceProvider, HttpContextPriceAudienceProvider>();

// Freno a la fuerza bruta: pocos intentos de login/codigo por IP y minuto.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AuthorizationPolicies.AuthRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// Produccion (lista exacta) y, opcionalmente, las vistas previas del Static Web App
// (Cors:PreviewOriginPattern). Las vistas previas solo leen: ver CorsOrigins.
var corsOrigins = CorsOrigins.FromConfiguration(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        policy
            .SetIsOriginAllowed(corsOrigins.IsAllowed)
            .AllowAnyHeader()
            .AllowAnyMethod()
            // La sesion viaja en cookie: solo los origenes listados pueden enviarla.
            .AllowCredentials();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "MagicBeauty.Store API v1");
        options.RoutePrefix = "swagger";
    });
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseResponseCompression();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Solo con almacenamiento local (Development sin Azure): el API sirve la carpeta de imagenes.
if (app.Services.GetService<LocalFileStorageOptions>() is { } localStorage)
{
    Directory.CreateDirectory(localStorage.RootPath);

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(Path.GetFullPath(localStorage.RootPath)),
        RequestPath = localStorage.RequestPath,
        // Los nombres son unicos (GUID): se pueden guardar en cache sin limite.
        OnPrepareResponse = context =>
            context.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable"
    });
}

app.UseCors(CorsPolicyName);

// Fuera de Development la cookie es SameSite=None: se exige un origen de produccion al
// modificar datos. Las vistas previas no estan en esa lista: pueden leer, no cambiar.
if (!app.Environment.IsDevelopment())
{
    app.UseMiddleware<CrossSiteRequestGuardMiddleware>(corsOrigins.Exact);
}

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    await next(context);
    var path = context.Request.Path;
    if (context.Response.StatusCode is >= 200 and < 300 &&
        !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) &&
        !HttpMethods.IsOptions(context.Request.Method) &&
        (path.StartsWithSegments("/api/products") || path.StartsWithSegments("/api/categories") ||
         path.StartsWithSegments("/api/brands") || path.StartsWithSegments("/api/price-types") ||
         path.StartsWithSegments("/api/integrations")))
    {
        context.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>()
            .Remove(MagicBeauty.Store.Api.Sales.SalesImportWorker.RankingCacheKey);
    }
});

app.MapControllers();

// Integracion Alegra (desmontable): sus rutas solo para administradores.
app.MapAlegraIntegration().RequireAuthorization(AuthorizationPolicies.StoreAdmin);

// Primer ADMIN de una base nueva: solo Development y solo con BootstrapAdmin configurado.
await app.BootstrapAdminAsync();

app.Run();
