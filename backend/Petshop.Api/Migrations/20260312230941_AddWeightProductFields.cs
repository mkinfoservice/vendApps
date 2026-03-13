using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWeightProductFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSoldByWeight",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ScaleBarcodeMode",
                table: "Products",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ScaleProductCode",
                table: "Products",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ScaleTareWeight",
                table: "Products",
                type: "numeric(8,3)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_Products_CompanyId_ScaleProductCode",
                table: "Products",
                columns: new[] { "CompanyId", "ScaleProductCode" },
                filter: "\"ScaleProductCode\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_CompanyId_ScaleProductCode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "IsSoldByWeight",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ScaleBarcodeMode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ScaleProductCode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ScaleTareWeight",
                table: "Products");
        }
    }
}
