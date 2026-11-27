using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrackCommercialRepurchaseNotices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CapturesCustomerEvidence",
                schema: "sales",
                table: "ImportRuns",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "CommercialNotices",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    AssignmentId = table.Column<long>(type: "bigint", nullable: false),
                    PurchaseOn = table.Column<DateOnly>(type: "date", nullable: false),
                    DueOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    AttemptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SentAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommercialNotices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommercialNotices_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CommercialNotices_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CommercialNotices_RoleId",
                table: "CommercialNotices",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CommercialNotices_Source_AttemptedAt_Id",
                table: "CommercialNotices",
                columns: new[] { "Source", "AttemptedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CommercialNotices_UserId_RoleId_AssignmentId_PurchaseOn_Kind",
                table: "CommercialNotices",
                columns: new[] { "UserId", "RoleId", "AssignmentId", "PurchaseOn", "Kind" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [CommercialNotices])
                    THROW 51004, 'La reversión eliminaría el registro de avisos comerciales.', 1;
                """);

            migrationBuilder.DropTable(
                name: "CommercialNotices");

            migrationBuilder.DropColumn(
                name: "CapturesCustomerEvidence",
                schema: "sales",
                table: "ImportRuns");
        }
    }
}
