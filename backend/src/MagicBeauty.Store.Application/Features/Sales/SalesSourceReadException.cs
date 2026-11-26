namespace MagicBeauty.Store.Application.Features.Sales;

/// <summary>Failure from an import source with a message safe to show to administrators.</summary>
public sealed class SalesSourceReadException(string message, Exception? innerException = null)
    : Exception(message, innerException);
