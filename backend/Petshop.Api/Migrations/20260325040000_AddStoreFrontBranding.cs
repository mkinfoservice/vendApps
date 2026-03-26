using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260325040000_AddStoreFrontBranding")]
public partial class AddStoreFrontBranding : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            ALTER TABLE ""StoreFrontConfigs""
                ADD COLUMN IF NOT EXISTS ""LogoUrl""     text         NULL,
                ADD COLUMN IF NOT EXISTS ""StoreName""   varchar(120) NULL,
                ADD COLUMN IF NOT EXISTS ""StoreSlogan"" varchar(200) NULL;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            ALTER TABLE ""StoreFrontConfigs""
                DROP COLUMN IF EXISTS ""LogoUrl"",
                DROP COLUMN IF EXISTS ""StoreName"",
                DROP COLUMN IF EXISTS ""StoreSlogan"";
        ");
    }
}
