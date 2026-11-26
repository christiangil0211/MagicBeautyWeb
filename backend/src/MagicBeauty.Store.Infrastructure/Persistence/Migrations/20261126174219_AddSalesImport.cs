using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "sales");

            migrationBuilder.CreateTable(
                name: "ImportRuns",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: true),
                    From = table.Column<DateOnly>(type: "date", nullable: false),
                    Through = table.Column<DateOnly>(type: "date", nullable: false),
                    LastSaleDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NextOffset = table.Column<int>(type: "int", nullable: false),
                    AllPagesRead = table.Column<bool>(type: "bit", nullable: false),
                    Pages = table.Column<int>(type: "int", nullable: false),
                    Invoices = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Error = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sales",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    SaleDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ImportedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SourceItemMappings",
                schema: "sales",
                columns: table => new
                {
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExternalItemId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SourceItemMappings", x => new { x.Source, x.ExternalItemId });
                    table.ForeignKey(
                        name: "FK_SourceItemMappings_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SaleLines",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SaleId = table.Column<long>(type: "bigint", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: true),
                    ExternalItemId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(19,6)", precision: 19, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaleLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SaleLines_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SaleLines_Sales_SaleId",
                        column: x => x.SaleId,
                        principalSchema: "sales",
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportRuns_Active",
                schema: "sales",
                table: "ImportRuns",
                column: "Active",
                unique: true,
                filter: "[Active] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_ImportRuns_Source_Status_FinishedAt",
                schema: "sales",
                table: "ImportRuns",
                columns: new[] { "Source", "Status", "FinishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SaleLines_ProductId",
                schema: "sales",
                table: "SaleLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleLines_SaleId",
                schema: "sales",
                table: "SaleLines",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_SaleDate_Status",
                schema: "sales",
                table: "Sales",
                columns: new[] { "SaleDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Source_ExternalId",
                schema: "sales",
                table: "Sales",
                columns: new[] { "Source", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SourceItemMappings_ProductId",
                schema: "sales",
                table: "SourceItemMappings",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportRuns",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "SaleLines",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "SourceItemMappings",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "Sales",
                schema: "sales");
        }
    }
}
