using System.Threading.RateLimiting;

using MagicBeauty.Store.Api.Middleware;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Api.Services;
using MagicBeauty.Store.Application;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Infrastructure;
using MagicBeauty.Store.Infrastructure.Storage;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "MagicBeautyCorsPolicy";

builder.Services.AddControllers();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.IsDevelopment());

builder.Services.AddStoreAuthentication(builder.Environment);

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

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
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

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Primer ADMIN de una base nueva: solo Development y solo con BootstrapAdmin configurado.
await app.BootstrapAdminAsync();

app.Run();
