using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleInvoiceDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                schema: "sales",
                table: "Sales",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentForm",
                schema: "sales",
                table: "Sales",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                schema: "sales",
                table: "Sales",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDate",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "PaymentForm",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                schema: "sales",
                table: "Sales");
        }
    }
}
