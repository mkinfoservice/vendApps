using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

namespace Petshop.Api.Migrations;

[Migration("20260415000001_AddProductSupplyLinks")]
[DbContext(typeof(AppDbContext))]
public class AddProductSupplyLinks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "ProductSupplyLinks" (
                "Id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
                "CompanyId"       uuid          NOT NULL,
                "ProductId"       uuid          NOT NULL,
                "SupplyId"        uuid          NOT NULL,
                "QuantityPerUnit" decimal(14,4) NOT NULL DEFAULT 1,
                "CreatedAtUtc"    timestamptz   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ProductSupplyLinks"
                    PRIMARY KEY ("Id"),
                CONSTRAINT "FK_PSL_Products"
                    FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_PSL_Supplies"
                    FOREIGN KEY ("SupplyId")  REFERENCES "Supplies"("Id") ON DELETE CASCADE,
                CONSTRAINT "UQ_PSL_ProductSupply"
                    UNIQUE ("ProductId", "SupplyId")
            );

            CREATE INDEX IF NOT EXISTS "IX_ProductSupplyLinks_ProductId"
                ON "ProductSupplyLinks" ("ProductId");

            CREATE INDEX IF NOT EXISTS "IX_ProductSupplyLinks_SupplyId"
                ON "ProductSupplyLinks" ("SupplyId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DROP TABLE IF EXISTS "ProductSupplyLinks";""");
    }
}
