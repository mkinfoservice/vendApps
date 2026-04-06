using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOperationalQuerySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── SaleOrders: rastreabilidade de operador e terminal ───────────────

            migrationBuilder.Sql("""
                ALTER TABLE "SaleOrders"
                    ADD COLUMN IF NOT EXISTS "CashRegisterNameSnapshot" character varying(80),
                    ADD COLUMN IF NOT EXISTS "OperatorUserId"           uuid,
                    ADD COLUMN IF NOT EXISTS "OperatorName"             character varying(100);
                """);

            // ── Orders: rastreabilidade de canal de origem ───────────────────────

            migrationBuilder.Sql("""
                ALTER TABLE "Orders"
                    ADD COLUMN IF NOT EXISTS "OriginChannel"      character varying(30),
                    ADD COLUMN IF NOT EXISTS "OriginSaleOrderId"  uuid;
                """);

            // ── SalesQuotes: ciclo de vida e expiração ───────────────────────────

            migrationBuilder.Sql("""
                ALTER TABLE "SalesQuotes"
                    ADD COLUMN IF NOT EXISTS "IsArchived"    boolean NOT NULL DEFAULT false,
                    ADD COLUMN IF NOT EXISTS "ArchivedAtUtc" timestamp with time zone,
                    ADD COLUMN IF NOT EXISTS "ExpiresAtUtc"  timestamp with time zone;
                """);

            // ── Índices de consulta (CREATE INDEX IF NOT EXISTS) ─────────────────

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Orders_CompanyId_OriginChannel"
                    ON "Orders" ("CompanyId", "OriginChannel");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_FiscalDocuments_CompanyId_SaleOrderId"
                    ON "FiscalDocuments" ("CompanyId", "SaleOrderId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_SalesQuotes_CompanyId_IsArchived_Status"
                    ON "SalesQuotes" ("CompanyId", "IsArchived", "Status");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_SalesQuotes_CompanyId_IsArchived_Status";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_FiscalDocuments_CompanyId_SaleOrderId";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Orders_CompanyId_OriginChannel";""");

            migrationBuilder.Sql("""
                ALTER TABLE "SalesQuotes"
                    DROP COLUMN IF EXISTS "ExpiresAtUtc",
                    DROP COLUMN IF EXISTS "ArchivedAtUtc",
                    DROP COLUMN IF EXISTS "IsArchived";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Orders"
                    DROP COLUMN IF EXISTS "OriginSaleOrderId",
                    DROP COLUMN IF EXISTS "OriginChannel";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "SaleOrders"
                    DROP COLUMN IF EXISTS "OperatorName",
                    DROP COLUMN IF EXISTS "OperatorUserId",
                    DROP COLUMN IF EXISTS "CashRegisterNameSnapshot";
                """);
        }
    }
}
