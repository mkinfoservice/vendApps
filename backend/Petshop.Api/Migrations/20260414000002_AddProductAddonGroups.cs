using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProductAddonGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductAddonGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    SelectionType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "multiple"),
                    MinSelections = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    MaxSelections = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductAddonGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductAddonGroups_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "AddonGroupId",
                table: "ProductAddons",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductAddonGroups_ProductId",
                table: "ProductAddonGroups",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductAddons_AddonGroupId",
                table: "ProductAddons",
                column: "AddonGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductAddons_ProductAddonGroups_AddonGroupId",
                table: "ProductAddons",
                column: "AddonGroupId",
                principalTable: "ProductAddonGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductAddons_ProductAddonGroups_AddonGroupId",
                table: "ProductAddons");

            migrationBuilder.DropIndex(
                name: "IX_ProductAddons_AddonGroupId",
                table: "ProductAddons");

            migrationBuilder.DropColumn(
                name: "AddonGroupId",
                table: "ProductAddons");

            migrationBuilder.DropTable(
                name: "ProductAddonGroups");
        }
    }
}
