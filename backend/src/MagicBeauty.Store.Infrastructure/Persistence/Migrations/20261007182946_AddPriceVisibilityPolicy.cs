using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceVisibilityPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "PriceTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "PriceTypes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RolePriceTypes",
                columns: table => new
                {
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    PriceTypeId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePriceTypes", x => new { x.RoleId, x.PriceTypeId });
                    table.ForeignKey(
                        name: "FK_RolePriceTypes_PriceTypes_PriceTypeId",
                        column: x => x.PriceTypeId,
                        principalTable: "PriceTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RolePriceTypes_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "PriceTypes",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "DisplayOrder", "IsPublic" },
                values: new object[] { 1, true });

            migrationBuilder.UpdateData(
                table: "PriceTypes",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "DisplayOrder", "IsPublic" },
                values: new object[] { 2, true });

            migrationBuilder.UpdateData(
                table: "PriceTypes",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "DisplayOrder", "IsPublic" },
                values: new object[] { 3, false });

            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "Code", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, "ADMIN", true, "Administrador" },
                    { 2, "CUSTOMER_RETAIL", true, "Cliente detal" },
                    { 3, "CUSTOMER_WHOLESALE", true, "Cliente mayorista" }
                });

            migrationBuilder.InsertData(
                table: "RolePriceTypes",
                columns: new[] { "PriceTypeId", "RoleId" },
                values: new object[,]
                {
                    { 1, 1 },
                    { 2, 1 },
                    { 3, 1 },
                    { 1, 2 },
                    { 2, 2 },
                    { 2, 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_RolePriceTypes_PriceTypeId",
                table: "RolePriceTypes",
                column: "PriceTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Code",
                table: "Roles",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RolePriceTypes");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "PriceTypes");

            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "PriceTypes");
        }
    }
}
