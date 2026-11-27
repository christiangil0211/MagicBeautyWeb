using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace MagicBeauty.Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommercialCustomerModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserRoles_Roles_RoleId",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_EmailVerificationCodes_UserId_ConsumedAt",
                table: "EmailVerificationCodes");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Users",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CommercialRoleId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CommercialRoleKind",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<long>(
                name: "CustomerId",
                table: "Users",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentNumber",
                table: "Users",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "Users",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Users",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Users",
                type: "rowversion",
                rowVersion: true,
                nullable: false);

            migrationBuilder.AddColumn<int>(
                name: "InternalRoleKind",
                table: "UserRoles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "CustomerId",
                schema: "sales",
                table: "Sales",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsSelfRequestable",
                table: "Roles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "Roles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RepurchaseDays",
                table: "Roles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Purpose",
                table: "EmailVerificationCodes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Roles_Id_Kind",
                table: "Roles",
                columns: new[] { "Id", "Kind" });

            migrationBuilder.CreateTable(
                name: "CommercialRoleHistory",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    PreviousRoleId = table.Column<int>(type: "int", nullable: true),
                    NewRoleId = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<int>(type: "int", nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    ChangedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommercialRoleHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommercialRoleHistory_Roles_NewRoleId",
                        column: x => x.NewRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CommercialRoleHistory_Roles_PreviousRoleId",
                        column: x => x.PreviousRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CommercialRoleHistory_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CommercialRoleHistory_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    DocumentNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    City = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    BillingAddress = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PrivacyConsents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    PolicyVersion = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Accepted = table.Column<bool>(type: "bit", nullable: false),
                    MarketingOptIn = table.Column<bool>(type: "bit", nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrivacyConsents", x => x.Id);
                    table.CheckConstraint("CK_PrivacyConsents_Accepted", "[Accepted] = 1");
                    table.ForeignKey(
                        name: "FK_PrivacyConsents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoleRequests",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RequestedRoleId = table.Column<int>(type: "int", nullable: false),
                    CommercialRoleKind = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    DocumentNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ReviewedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleRequests", x => x.Id);
                    table.CheckConstraint("CK_RoleRequests_CommercialRoleKind", "[CommercialRoleKind] = 1");
                    table.ForeignKey(
                        name: "FK_RoleRequests_Roles_RequestedRoleId_CommercialRoleKind",
                        columns: x => new { x.RequestedRoleId, x.CommercialRoleKind },
                        principalTable: "Roles",
                        principalColumns: new[] { "Id", "Kind" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoleRequests_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoleRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Conserva las filas históricas y su matriz. Se aborta sin elegir roles ambiguos.
            migrationBuilder.Sql("""
                EXEC(N'
                    IF NOT EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 1 AND [Code] = ''ADMIN'')
                       OR NOT EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 2 AND [Code] = ''CUSTOMER_RETAIL'')
                       OR NOT EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 3 AND [Code] = ''CUSTOMER_WHOLESALE'')
                       OR EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 4 OR [Code] = ''CUSTOMER_DISTRIBUTOR'')
                        THROW 51000, ''Las filas base de Roles difieren de la semilla esperada. Revisar IDs y códigos antes de migrar.'', 1;

                    UPDATE [Roles] SET [Kind] = 1 WHERE [Code] LIKE ''CUSTOMER[_]%'';
                    UPDATE [Roles] SET [IsSelfRequestable] = 1, [RepurchaseDays] = 30 WHERE [Id] = 3;

                    DECLARE @conflicts nvarchar(2048);
                    SELECT @conflicts = STRING_AGG(CONVERT(nvarchar(20), [UserId]), '','')
                    FROM (
                        SELECT TOP (10) links.[UserId]
                        FROM [UserRoles] links
                        JOIN [Roles] roles ON roles.[Id] = links.[RoleId]
                        WHERE roles.[Kind] = 1
                        GROUP BY links.[UserId]
                        HAVING COUNT(*) > 1
                        ORDER BY links.[UserId]
                    ) conflicts;
                    IF @conflicts IS NOT NULL
                    BEGIN
                        DECLARE @message nvarchar(2048) = CONCAT(
                            ''Hay usuarios con varios roles comerciales. Primeros IDs afectados: '', @conflicts);
                        THROW 51001, @message, 1;
                    END;

                    UPDATE users SET [CommercialRoleId] = links.[RoleId]
                    FROM [Users] users
                    JOIN [UserRoles] links ON links.[UserId] = users.[Id]
                    JOIN [Roles] roles ON roles.[Id] = links.[RoleId] AND roles.[Kind] = 1;

                    DELETE links FROM [UserRoles] links
                    JOIN [Roles] roles ON roles.[Id] = links.[RoleId] AND roles.[Kind] = 1;
                ');
                """);

            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "Code", "IsActive", "IsSelfRequestable", "Kind", "Name", "RepurchaseDays" },
                values: new object[] { 4, "CUSTOMER_DISTRIBUTOR", true, true, 1, "Cliente distribuidor", null });

            migrationBuilder.InsertData(
                table: "RolePriceTypes",
                columns: new[] { "PriceTypeId", "RoleId" },
                values: new object[] { 3, 4 });

            migrationBuilder.CreateIndex(
                name: "IX_Users_CommercialRoleId_CommercialRoleKind",
                table: "Users",
                columns: new[] { "CommercialRoleId", "CommercialRoleKind" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_CustomerId",
                table: "Users",
                column: "CustomerId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_CommercialRoleKind",
                table: "Users",
                sql: "[CommercialRoleKind] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId_InternalRoleKind",
                table: "UserRoles",
                columns: new[] { "RoleId", "InternalRoleKind" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserRoles_InternalRoleKind",
                table: "UserRoles",
                sql: "[InternalRoleKind] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_CustomerId_SaleDate",
                schema: "sales",
                table: "Sales",
                columns: new[] { "CustomerId", "SaleDate" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Roles_CommercialSettings",
                table: "Roles",
                sql: "([RepurchaseDays] IS NULL OR [RepurchaseDays] > 0) AND ([Kind] = 1 OR ([IsSelfRequestable] = 0 AND [RepurchaseDays] IS NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Roles_Kind",
                table: "Roles",
                sql: "[Kind] IN (0, 1)");

            migrationBuilder.CreateIndex(
                name: "IX_EmailVerificationCodes_UserId_Purpose_ConsumedAt",
                table: "EmailVerificationCodes",
                columns: new[] { "UserId", "Purpose", "ConsumedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CommercialRoleHistory_ActorUserId",
                table: "CommercialRoleHistory",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CommercialRoleHistory_NewRoleId",
                table: "CommercialRoleHistory",
                column: "NewRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CommercialRoleHistory_PreviousRoleId",
                table: "CommercialRoleHistory",
                column: "PreviousRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CommercialRoleHistory_UserId_ChangedAt",
                table: "CommercialRoleHistory",
                columns: new[] { "UserId", "ChangedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_DocumentNumber",
                table: "Customers",
                column: "DocumentNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Source_DocumentNumber",
                table: "Customers",
                columns: new[] { "Source", "DocumentNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Source_ExternalId",
                table: "Customers",
                columns: new[] { "Source", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrivacyConsents_UserId_AcceptedAt",
                table: "PrivacyConsents",
                columns: new[] { "UserId", "AcceptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RoleRequests_RequestedRoleId_CommercialRoleKind",
                table: "RoleRequests",
                columns: new[] { "RequestedRoleId", "CommercialRoleKind" });

            migrationBuilder.CreateIndex(
                name: "IX_RoleRequests_ReviewedByUserId",
                table: "RoleRequests",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleRequests_Status_CreatedAt",
                table: "RoleRequests",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RoleRequests_UserId",
                table: "RoleRequests",
                column: "UserId",
                unique: true,
                filter: "[Status] = 0");

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_Customers_CustomerId",
                schema: "sales",
                table: "Sales",
                column: "CustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserRoles_Roles_RoleId_InternalRoleKind",
                table: "UserRoles",
                columns: new[] { "RoleId", "InternalRoleKind" },
                principalTable: "Roles",
                principalColumns: new[] { "Id", "Kind" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Customers_CustomerId",
                table: "Users",
                column: "CustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Roles_CommercialRoleId_CommercialRoleKind",
                table: "Users",
                columns: new[] { "CommercialRoleId", "CommercialRoleKind" },
                principalTable: "Roles",
                principalColumns: new[] { "Id", "Kind" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // El esquema anterior solo puede recuperar asignaciones, no datos de nuevas funciones.
            migrationBuilder.Sql("""
                EXEC(N'
                    IF EXISTS (SELECT 1 FROM [Customers])
                       OR EXISTS (SELECT 1 FROM [PrivacyConsents])
                       OR EXISTS (SELECT 1 FROM [RoleRequests])
                       OR EXISTS (SELECT 1 FROM [CommercialRoleHistory])
                       OR EXISTS (SELECT 1 FROM [EmailVerificationCodes] WHERE [Purpose] <> 0)
                       OR EXISTS (SELECT 1 FROM [Users] WHERE [FullName] IS NOT NULL OR [Phone] IS NOT NULL
                                  OR [City] IS NOT NULL OR [DocumentNumber] IS NOT NULL OR [CommercialRoleId] = 4)
                       OR EXISTS (SELECT 1 FROM [RolePriceTypes] WHERE [RoleId] = 4 AND [PriceTypeId] <> 3)
                        THROW 51002, ''La reversión eliminaría datos del modelo comercial. Respaldarlos antes de revertir.'', 1;
                ');
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Sales_Customers_CustomerId",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropForeignKey(
                name: "FK_UserRoles_Roles_RoleId_InternalRoleKind",
                table: "UserRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Customers_CustomerId",
                table: "Users");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Roles_CommercialRoleId_CommercialRoleKind",
                table: "Users");

            migrationBuilder.DropTable(
                name: "CommercialRoleHistory");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "PrivacyConsents");

            migrationBuilder.DropTable(
                name: "RoleRequests");

            migrationBuilder.DropIndex(
                name: "IX_Users_CommercialRoleId_CommercialRoleKind",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_CustomerId",
                table: "Users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_CommercialRoleKind",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_UserRoles_RoleId_InternalRoleKind",
                table: "UserRoles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserRoles_InternalRoleKind",
                table: "UserRoles");

            migrationBuilder.Sql("""
                EXEC(N'
                    INSERT INTO [UserRoles] ([UserId], [RoleId], [InternalRoleKind])
                    SELECT [Id], [CommercialRoleId], 0 FROM [Users] WHERE [CommercialRoleId] IS NOT NULL;
                ');
                """);

            migrationBuilder.DropIndex(
                name: "IX_Sales_CustomerId_SaleDate",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Roles_Id_Kind",
                table: "Roles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Roles_CommercialSettings",
                table: "Roles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Roles_Kind",
                table: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_EmailVerificationCodes_UserId_Purpose_ConsumedAt",
                table: "EmailVerificationCodes");

            migrationBuilder.DeleteData(
                table: "RolePriceTypes",
                keyColumns: new[] { "PriceTypeId", "RoleId" },
                keyValues: new object[] { 3, 4 });

            migrationBuilder.DeleteData(
                table: "Roles",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DropColumn(
                name: "City",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CommercialRoleId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CommercialRoleKind",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DocumentNumber",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "InternalRoleKind",
                table: "UserRoles");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                schema: "sales",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "IsSelfRequestable",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "RepurchaseDays",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "EmailVerificationCodes");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_EmailVerificationCodes_UserId_ConsumedAt",
                table: "EmailVerificationCodes",
                columns: new[] { "UserId", "ConsumedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_UserRoles_Roles_RoleId",
                table: "UserRoles",
                column: "RoleId",
                principalTable: "Roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
