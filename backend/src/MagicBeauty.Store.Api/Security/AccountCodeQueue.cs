using System.Threading.Channels;

using MagicBeauty.Store.Application.Features.Accounts;

namespace MagicBeauty.Store.Api.Security;

/// <summary>Separa la entrega SMTP de la respuesta pública para que su latencia no revele cuentas.</summary>
public sealed class AccountCodeQueue
{
    private readonly Channel<AccountCodeJob> queue = Channel.CreateBounded<AccountCodeJob>(128);

    public bool TryEnqueueRegistration(int userId) => queue.Writer.TryWrite(new AccountCodeJob(userId, null));

    public bool TryEnqueueRecovery(string email) => queue.Writer.TryWrite(new AccountCodeJob(null, email));

    internal IAsyncEnumerable<AccountCodeJob> ReadAsync(CancellationToken cancellationToken) =>
        queue.Reader.ReadAllAsync(cancellationToken);

    internal sealed record AccountCodeJob(int? RegistrationUserId, string? RecoveryEmail);
}

public sealed class AccountCodeWorker(
    AccountCodeQueue queue, IServiceScopeFactory scopes, ILogger<AccountCodeWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAsync(stoppingToken))
        {
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(Filters.AuthRequestBudget.Default.Timeout);
                await using var scope = scopes.CreateAsyncScope();
                var accounts = scope.ServiceProvider.GetRequiredService<IAccountService>();
                if (job.RegistrationUserId is { } userId)
                    await accounts.SendRegistrationCodeAsync(userId, timeout.Token);
                else
                    await accounts.SendPasswordResetCodeAsync(job.RecoveryEmail!, timeout.Token);
            }
            catch (Exception failure) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("No se pudo enviar el código de cuenta ({ErrorType}).", failure.GetType().Name);
            }
        }
    }
}
