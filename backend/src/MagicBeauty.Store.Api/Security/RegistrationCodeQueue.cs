using System.Threading.Channels;

using MagicBeauty.Store.Application.Features.Accounts;

namespace MagicBeauty.Store.Api.Security;

/// <summary>Separa la entrega SMTP de la respuesta pública para que su latencia no revele altas.</summary>
public sealed class RegistrationCodeQueue
{
    private readonly Channel<int> queue = Channel.CreateBounded<int>(128);

    public bool TryEnqueue(int userId) => queue.Writer.TryWrite(userId);

    public IAsyncEnumerable<int> ReadAsync(CancellationToken cancellationToken) =>
        queue.Reader.ReadAllAsync(cancellationToken);
}

public sealed class RegistrationCodeWorker(
    RegistrationCodeQueue queue, IServiceScopeFactory scopes, ILogger<RegistrationCodeWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var userId in queue.ReadAsync(stoppingToken))
        {
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(Filters.AuthRequestBudget.Default.Timeout);
                await using var scope = scopes.CreateAsyncScope();
                var accounts = scope.ServiceProvider.GetRequiredService<IAccountService>();
                await accounts.SendRegistrationCodeAsync(userId, timeout.Token);
            }
            catch (Exception failure) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("No se pudo enviar el código de alta ({ErrorType}).", failure.GetType().Name);
            }
        }
    }
}
