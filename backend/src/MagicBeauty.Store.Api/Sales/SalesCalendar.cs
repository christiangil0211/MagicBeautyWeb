namespace MagicBeauty.Store.Api.Sales;

internal static class SalesCalendar
{
    private static readonly TimeZoneInfo Colombia = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");

    public static DateOnly Today(TimeProvider clock) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), Colombia).DateTime);
}
