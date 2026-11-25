using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MagicBeauty.Store.Integrations.Alegra.Client;

public interface IAlegraClient
{
    /// <summary>Todos los items de Alegra, recorriendo las paginas.</summary>
    Task<IReadOnlyList<AlegraItem>> GetItemsAsync(CancellationToken cancellationToken);
}

/// <summary>Error al hablar con Alegra; su mensaje se puede mostrar al administrador.</summary>
public sealed class AlegraException(string message, Exception? innerException = null)
    : Exception(message, innerException);

/// <summary>
/// Cliente HTTP de la API de Alegra (autenticacion basica correo:token, la
/// configura <see cref="DependencyInjection.AddAlegraIntegration"/>).
/// </summary>
public sealed class AlegraClient(
    HttpClient httpClient,
    IOptions<AlegraOptions> options,
    ILogger<AlegraClient> logger) : IAlegraClient
{
    /// <summary>Freno ante una respuesta que no avanza: 30 x 2.000 = 60.000 items.</summary>
    private const int MaxPages = 2_000;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<AlegraItem>> GetItemsAsync(CancellationToken cancellationToken)
    {
        var pageSize = Math.Clamp(options.Value.PageSize, 1, 30);
        var items = new List<AlegraItem>();

        for (var page = 0; page < MaxPages; page++)
        {
            var start = page * pageSize;
            var batch = await GetPageAsync($"items?start={start}&limit={pageSize}", cancellationToken);
            items.AddRange(batch);

            if (batch.Count < pageSize)
            {
                return items;
            }
        }

        throw new AlegraException("Alegra devolvió más páginas de las esperadas. Revisa la configuración de la integración.");
    }

    private async Task<List<AlegraItem>> GetPageAsync(string path, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;

        try
        {
            response = await httpClient.GetAsync(path, cancellationToken);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AlegraException("Alegra tardó demasiado en responder. Inténtalo de nuevo en unos minutos.", exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "No se pudo conectar con Alegra");
            throw new AlegraException("No se pudo conectar con Alegra. Inténtalo de nuevo en unos minutos.", exception);
        }

        using (response)
        {
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            {
                throw new AlegraException("Alegra rechazó las credenciales. Revisa el correo y el token de la integración.");
            }

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                throw new AlegraException("Alegra limitó las consultas por ahora. Inténtalo de nuevo en unos minutos.");
            }

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Alegra respondio {StatusCode} en {Path}", (int)response.StatusCode, path);
                throw new AlegraException($"Alegra respondió con un error ({(int)response.StatusCode}). Inténtalo de nuevo más tarde.");
            }

            try
            {
                return await response.Content.ReadFromJsonAsync<List<AlegraItem>>(JsonOptions, cancellationToken) ?? [];
            }
            catch (JsonException exception)
            {
                throw new AlegraException("La respuesta de Alegra no tiene el formato esperado.", exception);
            }
        }
    }
}
