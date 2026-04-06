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

            migrationBuilder.AddColumn<string>(
                name: "CashRegisterNameSnapshot",
                table: "SaleOrders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OperatorName",
                table: "SaleOrders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OperatorUserId",
                table: "SaleOrders",
                type: "uuid",
                nullable: true);

            // ── Orders: rastreabilidade de canal de origem ───────────────────────

            migrationBuilder.AddColumn<string>(
                name: "OriginChannel",
                table: "Orders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OriginSaleOrderId",
                table: "Orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CompanyId_OriginChannel",
                table: "Orders",
                columns: new[] { "CompanyId", "OriginChannel" });

            // ── FiscalDocuments: índice para lookup por venda ────────────────────
            // Permite JOIN eficiente FiscalDocuments → SaleOrders sem full-scan

            migrationBuilder.CreateIndex(
                name: "IX_FiscalDocuments_CompanyId_SaleOrderId",
                table: "FiscalDocuments",
                columns: new[] { "CompanyId", "SaleOrderId" });

            // ── SalesQuotes: ciclo de vida e expiração ───────────────────────────

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "SalesQuotes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAtUtc",
                table: "SalesQuotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAtUtc",
                table: "SalesQuotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesQuotes_CompanyId_IsArchived_Status",
                table: "SalesQuotes",
                columns: new[] { "CompanyId", "IsArchived", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalesQuotes_CompanyId_IsArchived_Status",
                table: "SalesQuotes");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "SalesQuotes");

            migrationBuilder.DropColumn(
                name: "ArchivedAtUtc",
                table: "SalesQuotes");

            migrationBuilder.DropColumn(
                name: "ExpiresAtUtc",
                table: "SalesQuotes");

            migrationBuilder.DropIndex(
                name: "IX_FiscalDocuments_CompanyId_SaleOrderId",
                table: "FiscalDocuments");

            migrationBuilder.DropIndex(
                name: "IX_Orders_CompanyId_OriginChannel",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OriginChannel",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OriginSaleOrderId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CashRegisterNameSnapshot",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "OperatorName",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "OperatorUserId",
                table: "SaleOrders");
        }
    }
}
