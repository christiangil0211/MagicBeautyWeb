using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Integrations.Alegra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAlegraProductLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "alegra");

            migrationBuilder.CreateTable(
                name: "ProductLinks",
                schema: "alegra",
                columns: table => new
                {
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    AlegraItemId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DescriptionHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LinkedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductLinks", x => x.ProductId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductLinks_AlegraItemId",
                schema: "alegra",
                table: "ProductLinks",
                column: "AlegraItemId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductLinks",
                schema: "alegra");
        }
    }
}
