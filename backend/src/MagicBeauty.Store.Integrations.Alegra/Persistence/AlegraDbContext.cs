using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MagicBeauty.Store.Integrations.Alegra.Persistence;

/// <summary>
/// Datos propios de la integracion, en el esquema <c>alegra</c> de la misma base y
/// con su propio historial de migraciones (<c>alegra.__EFMigrationsHistory</c>).
/// No conoce las tablas de la tienda: retirar la integracion es borrar el esquema.
/// </summary>
public sealed class AlegraDbContext(DbContextOptions<AlegraDbContext> options) : DbContext(options)
{
    public const string Schema = "alegra";

    public DbSet<AlegraProductLink> ProductLinks => Set<AlegraProductLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<AlegraProductLink>(link =>
        {
            link.ToTable("ProductLinks");
            // Un producto de la tienda se asocia a un solo item de Alegra y viceversa.
            link.HasKey(item => item.ProductId);
            link.Property(item => item.ProductId).ValueGeneratedNever();
            link.Property(item => item.AlegraItemId).HasMaxLength(50).IsRequired();
            link.HasIndex(item => item.AlegraItemId).IsUnique();
            link.Property(item => item.DescriptionHash).HasMaxLength(64);
        });
    }
}

/// <summary>
/// Para <c>dotnet ef</c>: la integracion maneja sus migraciones sin arrancar el API.
/// Generar migraciones o el script no se conecta a ninguna base. Para aplicarlas se
/// pasa la cadena con <c>--connection</c> o en la variable <c>ALEGRA_DB_CONNECTION</c>.
/// </summary>
internal sealed class AlegraDbContextDesignFactory : IDesignTimeDbContextFactory<AlegraDbContext>
{
    public AlegraDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ALEGRA_DB_CONNECTION")
            ?? "Server=.;Database=MagicBeauty;Trusted_Connection=True;TrustServerCertificate=True";

        return new(new DbContextOptionsBuilder<AlegraDbContext>()
            .UseSqlServer(connectionString, sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", AlegraDbContext.Schema))
            .Options);
    }
}
