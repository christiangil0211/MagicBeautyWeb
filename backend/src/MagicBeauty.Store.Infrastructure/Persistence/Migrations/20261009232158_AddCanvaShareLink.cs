using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCanvaShareLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanvaEmbeddable",
                table: "TraditionalCatalogs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CanvaShareUrl",
                table: "TraditionalCatalogs",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            // Catalogos ya guardados: se validaron como enlaces de insercion, asi que se
            // pueden mostrar en la tienda y su enlace para abrir en Canva es la vista.
            migrationBuilder.Sql(
                "UPDATE TraditionalCatalogs SET CanvaShareUrl = REPLACE(CanvaEmbedUrl, '/view?embed', '/view'), CanvaEmbeddable = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanvaEmbeddable",
                table: "TraditionalCatalogs");

            migrationBuilder.DropColumn(
                name: "CanvaShareUrl",
                table: "TraditionalCatalogs");
        }
    }
}
