using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryHomeCarousel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShowAsHomeCarousel",
                table: "Categories",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShowAsHomeCarousel",
                table: "Categories");
        }
    }
}
