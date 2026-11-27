using System.Globalization;
using System.Security.Claims;

using MagicBeauty.Store.Application.Features.Accounts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

namespace MagicBeauty.Store.Api.Security;

/// <summary>Verifica la vigencia del ticket antes de que sus claims autoricen una petición.</summary>
internal static class StoreSessionValidation
{
    public const string StampClaim = "magicbeauty:security-stamp";
    private const string StartedAt = "magicbeauty:started-at";
    private const string CheckedAt = "magicbeauty:checked-at";

    public static Task InitializeAsync(CookieSigningInContext context)
    {
        var now = Format(context.Options.TimeProvider!.GetUtcNow());
        context.Properties.SetString(StartedAt, now);
        context.Properties.SetString(CheckedAt, now);

        return Task.CompletedTask;
    }

    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        var now = context.Options.TimeProvider!.GetUtcNow();
        var services = context.HttpContext.RequestServices;
        var options = services.GetRequiredService<IOptions<StoreSessionOptions>>().Value;
        var principal = context.Principal;

        if (!TryReadTimestamp(context.Properties, StartedAt, out var started) ||
            !TryReadTimestamp(context.Properties, CheckedAt, out var checkedAt) ||
            !int.TryParse(principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
            !Guid.TryParse(principal.FindFirstValue(StampClaim), out var stamp) ||
            now.UtcTicks - started >= TimeSpan.FromHours(options.AbsoluteLifetimeHours).Ticks)
        {
            await RejectAsync(context);
            return;
        }

        if (now.UtcTicks - checkedAt < TimeSpan.FromMinutes(options.ValidationIntervalMinutes).Ticks)
        {
            return;
        }

        var accounts = services.GetRequiredService<IAccountService>();
        var current = await accounts.GetSessionAccountAsync(userId, context.HttpContext.RequestAborted);

        // Comprueba también los roles vigentes por si se desactivó un rol completo.
        if (current is null || current.SecurityStamp != stamp ||
            !current.RoleCodes.ToHashSet(StringComparer.Ordinal)
                .SetEquals(principal.FindAll(ClaimTypes.Role).Select(claim => claim.Value)))
        {
            await RejectAsync(context);
            return;
        }

        // Conserva el inicio original al persistir la hora de la última comprobación.
        context.Properties.SetString(CheckedAt, Format(now));
        context.ShouldRenew = true;
    }

    private static string Format(DateTimeOffset time) => time.UtcTicks.ToString(CultureInfo.InvariantCulture);

    private static bool TryReadTimestamp(AuthenticationProperties properties, string key, out long ticks) =>
        long.TryParse(properties.GetString(key), NumberStyles.None, CultureInfo.InvariantCulture, out ticks);

    private static Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        return context.HttpContext.SignOutAsync(context.Scheme.Name);
    }
}
