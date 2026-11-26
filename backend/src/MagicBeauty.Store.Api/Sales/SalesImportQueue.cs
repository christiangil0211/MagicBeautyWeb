using System.Threading.Channels;

namespace MagicBeauty.Store.Api.Sales;

public sealed class SalesImportQueue
{
    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>();
    private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public Task Ready => ready.Task;
    public void MarkReady() => ready.TrySetResult();
    public void Enqueue(Guid id) => channel.Writer.TryWrite(id);
    public IAsyncEnumerable<Guid> ReadAsync(CancellationToken token) => channel.Reader.ReadAllAsync(token);
}
