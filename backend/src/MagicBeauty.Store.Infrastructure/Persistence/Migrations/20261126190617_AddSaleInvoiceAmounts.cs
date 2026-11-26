using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleInvoiceAmounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Balance",
                schema: "sales",
                table: "Sales",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Discount",
                schema: "sales",
                table: "Sales",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Subtotal",
                schema: "sales",
                table: "Sales",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Tax",
                schema: "sales",
                table: "Sales",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Total",
                schema: "sales",
                table: "Sales",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalPaid",
                schema: "sales",
                table: "Sales",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Total",
                schema: "sales",
                table: "SaleLines",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitPrice",
                schema: "sales",
                table: "SaleLines",
                type: "decimal(19,4)",
                precision: 19,
                scale: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Balance",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Discount",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Subtotal",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Tax",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Total",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "TotalPaid",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Total",
                schema: "sales",
                table: "SaleLines");

            migrationBuilder.DropColumn(
                name: "UnitPrice",
                schema: "sales",
                table: "SaleLines");
        }
    }
}
