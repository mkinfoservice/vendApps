using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260325010000_AddStoreFrontModule")]
public partial class AddStoreFrontModule : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            CREATE TABLE IF NOT EXISTS ""StoreFrontConfigs"" (
                ""Id""                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                ""CompanyId""           uuid         NOT NULL REFERENCES ""Companies""(""Id"") ON DELETE CASCADE,
                ""PrimaryColor""        varchar(10)  NOT NULL DEFAULT '#7c5cf8',
                ""BannerIntervalSecs""  int          NOT NULL DEFAULT 5,
                ""UpdatedAtUtc""        timestamptz  NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_StoreFrontConfigs_CompanyId""
                ON ""StoreFrontConfigs""(""CompanyId"");

            CREATE TABLE IF NOT EXISTS ""BannerSlides"" (
                ""Id""                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                ""StoreFrontConfigId""  uuid         NOT NULL REFERENCES ""StoreFrontConfigs""(""Id"") ON DELETE CASCADE,
                ""ImageUrl""            varchar(200) NULL,
                ""Title""               varchar(120) NULL,
                ""Subtitle""            varchar(200) NULL,
                ""CtaText""             varchar(60)  NULL,
                ""CtaType""             varchar(20)  NOT NULL DEFAULT 'none',
                ""CtaTarget""           varchar(500) NULL,
                ""CtaNewTab""           boolean      NOT NULL DEFAULT false,
                ""SortOrder""           int          NOT NULL DEFAULT 0,
                ""IsActive""            boolean      NOT NULL DEFAULT true,
                ""CreatedAtUtc""        timestamptz  NOT NULL DEFAULT now(),
                ""UpdatedAtUtc""        timestamptz  NULL
            );

            CREATE INDEX IF NOT EXISTS ""IX_BannerSlides_StoreFrontConfigId""
                ON ""BannerSlides""(""StoreFrontConfigId"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DROP TABLE IF EXISTS ""BannerSlides"";
            DROP TABLE IF EXISTS ""StoreFrontConfigs"";
        ");
    }
}
