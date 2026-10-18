using System.Net;
using System.Net.Mail;

using MagicBeauty.Store.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Infrastructure.Services;

/// <summary>Configuracion SMTP. Se define en User Secrets o variables de entorno, nunca en el repositorio.</summary>
public sealed class SmtpEmailOptions
{
    public const string SectionName = "Email:Smtp";

    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public bool EnableSsl { get; set; } = true;

    public string? Username { get; set; }

    public string? Password { get; set; }

    public string? From { get; set; }

    /// <summary>
    /// SmtpClient.Timeout no aplica a SendMailAsync: sin este limite un servidor de
    /// correo colgado retendria la peticion. En el login manda ademas el presupuesto
    /// de autenticacion (13 s), que cancela el envio si se agota antes.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 10;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(From);
}

public sealed class SmtpEmailSender(SmtpEmailOptions options) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.TimeoutSeconds));

        try
        {
            await SendCoreAsync(to, subject, body, timeout.Token);
        }
        // Al cancelar, SmtpClient no siempre lanza OperationCanceledException: corta la
        // conexion y lanza SmtpException ("Failure sending mail"). Lo que decide es el token.
        catch (Exception) when (cancellationToken.IsCancellationRequested)
        {
            throw new OperationCanceledException(cancellationToken);
        }
        catch (Exception) when (timeout.IsCancellationRequested)
        {
            // Sin reintento: quien llama no guarda nada si el envio falla.
            throw new TimeoutException("El servidor de correo no respondio a tiempo.");
        }
    }

    private async Task SendCoreAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        using var message = new MailMessage(options.From!, to, subject, body)
        {
            // Tildes y eñes llegan bien en cualquier cliente de correo.
            SubjectEncoding = System.Text.Encoding.UTF8,
            BodyEncoding = System.Text.Encoding.UTF8
        };
        using var client = new SmtpClient(options.Host, options.Port)
        {
            EnableSsl = options.EnableSsl
        };

        if (!string.IsNullOrWhiteSpace(options.Username))
        {
            client.Credentials = new NetworkCredential(options.Username, options.Password);
        }

        await client.SendMailAsync(message, cancellationToken);
    }
}

/// <summary>
/// Solo Development y sin SMTP configurado: no envia nada, deja el mensaje en el
/// log y en una carpeta local fuera del repositorio para poder leer el codigo.
/// </summary>
public sealed class DevelopmentEmailSender(
    ILogger<DevelopmentEmailSender> logger,
    string outputDirectory) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(outputDirectory);

        var safeRecipient = string.Concat(to.Select(ch => char.IsLetterOrDigit(ch) ? ch : '_'));
        var path = Path.Combine(
            outputDirectory,
            DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + "-" + safeRecipient + ".txt");

        await File.WriteAllTextAsync(path, "Para: " + to + "\nAsunto: " + subject + "\n\n" + body, cancellationToken);

        logger.LogWarning(
            "[Correo de desarrollo, no enviado] Para: {To} | {Subject}\n{Body}\nGuardado en: {Path}",
            to,
            subject,
            body,
            path);
    }
}

/// <summary>Fuera de Development sin SMTP configurado: falla de forma explicita en lugar de fingir el envio.</summary>
public sealed class UnconfiguredEmailSender : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        throw new InvalidOperationException("El envio de correo no esta configurado. Contacta al administrador.");
    }
}
