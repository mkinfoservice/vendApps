using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260324000001_AddProductPromotionalFields")]
public partial class AddProductPromotionalFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsFeatured",
            table: "Products",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "IsBestSeller",
            table: "Products",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<int>(
            name: "DiscountPercent",
            table: "Products",
            type: "integer",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "IsFeatured",     table: "Products");
        migrationBuilder.DropColumn(name: "IsBestSeller",   table: "Products");
        migrationBuilder.DropColumn(name: "DiscountPercent", table: "Products");
    }
}
