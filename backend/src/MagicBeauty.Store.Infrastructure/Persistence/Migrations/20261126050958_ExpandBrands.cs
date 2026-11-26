using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpandBrands : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "BrandId",
                table: "Products",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Brands",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFeatured",
                table: "Brands",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "Brands",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Brands",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Brands",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Slug de las marcas existentes, antes del índice único: sin tildes (la
            // intercalación 1253 las quita al pasar a varchar), en minúsculas, con
            // guiones en lugar de espacios y signos. Si dos marcas quedan con el mismo
            // slug, la segunda recibe su Id al final. Solo llena los que están vacíos.
            migrationBuilder.Sql(@"
UPDATE b SET Slug = s.Slug
FROM dbo.Brands b
CROSS APPLY (SELECT LOWER(CAST(b.Name COLLATE SQL_Latin1_General_CP1253_CI_AI AS varchar(150))) AS Plain) p
CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.Plain,
    '&', ' '), '.', ' '), ',', ' '), '''', ' '), '/', ' '), '(', ' '), ')', ' '), '+', ' '), '_', ' '), '#', ' ') AS Spaced) a
CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(a.Spaced)), '  ', ' '), '  ', ' '), '  ', ' ') AS Single) c
CROSS APPLY (SELECT REPLACE(REPLACE(c.Single, ' ', '-'), '--', '-') AS Slug) s
WHERE b.Slug IS NULL OR b.Slug = '';

WITH Ranked AS (
    SELECT Id, Slug, ROW_NUMBER() OVER (PARTITION BY Slug ORDER BY Id) AS Position
    FROM dbo.Brands
    WHERE Slug IS NOT NULL)
UPDATE Ranked SET Slug = LEFT(Slug, 110) + '-' + CAST(Id AS varchar(10))
WHERE Position > 1;");

            migrationBuilder.CreateIndex(
                name: "IX_Brands_Slug",
                table: "Brands",
                column: "Slug",
                unique: true,
                filter: "[Slug] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Brands_Slug",
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "IsFeatured",
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Brands");

            migrationBuilder.AlterColumn<int>(
                name: "BrandId",
                table: "Products",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
