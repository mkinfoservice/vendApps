using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260325030000_BannerSlideImageUrlText")]
public partial class BannerSlideImageUrlText : Migration
{
    /// <summary>
    /// Amplia ImageUrl de varchar(200) para text para suportar data URIs base64.
    /// Um banner JPEG de ~200KB ocupa ~270KB em base64 — cabe em text sem problemas.
    /// </summary>
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            ALTER TABLE ""BannerSlides""
                ALTER COLUMN ""ImageUrl"" TYPE text;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            ALTER TABLE ""BannerSlides""
                ALTER COLUMN ""ImageUrl"" TYPE varchar(200) USING ""ImageUrl""::varchar(200);
        ");
    }
}
