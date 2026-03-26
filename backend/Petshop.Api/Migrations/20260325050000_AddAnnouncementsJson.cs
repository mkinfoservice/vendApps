using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

namespace Petshop.Api.Migrations;

[Migration("20260325050000_AddAnnouncementsJson")]
[DbContext(typeof(AppDbContext))]
public class AddAnnouncementsJson : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "StoreFrontConfigs"
            ADD COLUMN IF NOT EXISTS "AnnouncementsJson" text NOT NULL
                DEFAULT '["Frete Grátis acima de R$ 100"]';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "StoreFrontConfigs"
            DROP COLUMN IF EXISTS "AnnouncementsJson";
            """);
    }
}
