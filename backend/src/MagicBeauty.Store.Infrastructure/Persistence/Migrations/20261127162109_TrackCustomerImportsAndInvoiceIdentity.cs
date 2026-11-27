using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrackCustomerImportsAndInvoiceIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerDocumentNumber",
                schema: "sales",
                table: "Sales",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerExternalId",
                schema: "sales",
                table: "Sales",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Contacts",
                schema: "sales",
                table: "ImportRuns",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                schema: "sales",
                table: "ImportRuns",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SkippedContacts",
                schema: "sales",
                table: "ImportRuns",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                EXEC(N'
                    IF EXISTS (SELECT 1 FROM [sales].[ImportRuns] WHERE [Kind] <> 0)
                       OR EXISTS (SELECT 1 FROM [sales].[Sales]
                                  WHERE [CustomerDocumentNumber] IS NOT NULL OR [CustomerExternalId] IS NOT NULL)
                        THROW 51003, ''La reversión eliminaría evidencia de clientes o importaciones de contactos.'', 1;
                ');
                """);

            migrationBuilder.DropColumn(
                name: "CustomerDocumentNumber",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "CustomerExternalId",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Contacts",
                schema: "sales",
                table: "ImportRuns");

            migrationBuilder.DropColumn(
                name: "Kind",
                schema: "sales",
                table: "ImportRuns");

            migrationBuilder.DropColumn(
                name: "SkippedContacts",
                schema: "sales",
                table: "ImportRuns");
        }
    }
}
