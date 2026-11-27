using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHomeBanners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HomeBanners",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AltText = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageWidth = table.Column<int>(type: "int", nullable: false),
                    ImageHeight = table.Column<int>(type: "int", nullable: false),
                    ImageUrl768 = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageUrl1280 = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    LinkUrl = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    LinkLabel = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    HotspotsJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MobileCtasJson = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    NoteHighlight = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    NoteText = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HomeBanners", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HomeBanners_IsActive_SortOrder",
                table: "HomeBanners",
                columns: new[] { "IsActive", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HomeBanners");
        }
    }
}
