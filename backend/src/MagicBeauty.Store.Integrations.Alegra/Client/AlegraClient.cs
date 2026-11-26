using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

using MagicBeauty.Store.Application.Features.Sales;
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

    internal Task<List<AlegraInvoice>> GetInvoicesAsync(
        DateOnly from, DateOnly through, int offset, int limit, CancellationToken cancellationToken) =>
        GetSalesAsync<List<AlegraInvoice>>(
            FormattableString.Invariant($"invoices?start={offset}&limit={limit}&date_afterOrNow={from:yyyy-MM-dd}&date_beforeOrNow={through:yyyy-MM-dd}&order_field=id&order_direction=ASC"),
            cancellationToken);

    internal Task<AlegraInvoice> GetInvoiceAsync(string id, CancellationToken cancellationToken) =>
        GetSalesAsync<AlegraInvoice>($"invoices/{Uri.EscapeDataString(id)}", cancellationToken);

    private async Task<T> GetSalesAsync<T>(string path, CancellationToken cancellationToken) where T : class
    {
        const int attempts = 4;
        for (var attempt = 1; ; attempt++)
        {
            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1));
            try
            {
                using var response = await httpClient.GetAsync(path, cancellationToken);
                if (response.IsSuccessStatusCode)
                    return await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken)
                        ?? throw new SalesSourceReadException("La respuesta de ventas está vacía.");

                var transient = response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
                if (!transient || attempt >= attempts)
                    throw new SalesSourceReadException($"La consulta de ventas falló (HTTP {(int)response.StatusCode}).");

                var requested = response.Headers.RetryAfter?.Delta
                    ?? (response.Headers.RetryAfter?.Date is { } date ? date - DateTimeOffset.UtcNow : TimeSpan.Zero);
                if (response.Headers.TryGetValues("X-Rate-Limit-Reset", out var values) &&
                    int.TryParse(values.FirstOrDefault(), out var seconds) && seconds >= 0)
                    requested = TimeSpan.FromSeconds(Math.Max(requested.TotalSeconds, seconds));

                if (requested > delay) delay = requested;
                if (delay > TimeSpan.FromMinutes(5))
                    throw new SalesSourceReadException("La espera solicitada supera el límite de reintento. Reanuda la importación más tarde.");
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested &&
                exception is HttpRequestException or TaskCanceledException)
            {
                if (attempt >= attempts)
                    throw new SalesSourceReadException("El origen de ventas no respondió después de varios intentos.", exception);
            }
            catch (JsonException exception)
            {
                throw new SalesSourceReadException("El origen devolvió una factura con un formato inesperado.", exception);
            }

            await Task.Delay(delay, cancellationToken);
        }
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
