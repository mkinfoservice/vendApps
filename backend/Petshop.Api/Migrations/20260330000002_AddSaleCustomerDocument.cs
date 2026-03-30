using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

namespace Petshop.Api.Migrations;

[Migration("20260330000002_AddSaleCustomerDocument")]
[DbContext(typeof(AppDbContext))]
public class AddSaleCustomerDocument : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SaleOrders"
                ADD COLUMN IF NOT EXISTS "CustomerDocument" varchar(20);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SaleOrders"
                DROP COLUMN IF EXISTS "CustomerDocument";
            """);
    }
}
