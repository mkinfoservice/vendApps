using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260314200001_AddFiscalCertBase64Column")]
    public partial class AddFiscalCertBase64Column : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Adiciona a coluna somente se ainda não existir (idempotente)
            migrationBuilder.Sql("""
                ALTER TABLE "FiscalConfigs"
                ADD COLUMN IF NOT EXISTS "CertificateBase64" text;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CertificateBase64",
                table: "FiscalConfigs");
        }
    }
}
