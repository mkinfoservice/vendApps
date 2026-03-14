using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
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
