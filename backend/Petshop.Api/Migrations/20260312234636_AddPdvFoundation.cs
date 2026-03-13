using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPdvFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                table: "SaleOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CashRegisterId",
                table: "SaleOrders",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "CashSessionId",
                table: "SaleOrders",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAtUtc",
                table: "SaleOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CustomerId",
                table: "SaleOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerName",
                table: "SaleOrders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CustomerPhone",
                table: "SaleOrders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DiscountCents",
                table: "SaleOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FiscalDecision",
                table: "SaleOrders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "FiscalDocumentId",
                table: "SaleOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "SaleOrders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "SaleOrders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SubtotalCents",
                table: "SaleOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TotalCents",
                table: "SaleOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CashRegisters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    FiscalSerie = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    FiscalAutoIssuePix = table.Column<bool>(type: "boolean", nullable: false),
                    FiscalSendCashToSefaz = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashRegisters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashRegisters_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SaleOrderItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductNameSnapshot = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    ProductBarcodeSnapshot = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Qty = table.Column<decimal>(type: "numeric(14,3)", nullable: false),
                    UnitPriceCentsSnapshot = table.Column<int>(type: "integer", nullable: false),
                    TotalCents = table.Column<int>(type: "integer", nullable: false),
                    IsSoldByWeight = table.Column<bool>(type: "boolean", nullable: false),
                    WeightKg = table.Column<decimal>(type: "numeric(8,3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaleOrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SaleOrderItems_SaleOrders_SaleOrderId",
                        column: x => x.SaleOrderId,
                        principalTable: "SaleOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalePayments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AmountCents = table.Column<int>(type: "integer", nullable: false),
                    ChangeCents = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalePayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalePayments_SaleOrders_SaleOrderId",
                        column: x => x.SaleOrderId,
                        principalTable: "SaleOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CashSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CashRegisterId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenedByUserName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ClosedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedByUserName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    OpeningBalanceCents = table.Column<int>(type: "integer", nullable: false),
                    ClosingBalanceCents = table.Column<int>(type: "integer", nullable: true),
                    TotalSalesCount = table.Column<int>(type: "integer", nullable: false),
                    TotalSalesCents = table.Column<int>(type: "integer", nullable: false),
                    PermanentContingencyCount = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OpenedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashSessions_CashRegisters_CashRegisterId",
                        column: x => x.CashRegisterId,
                        principalTable: "CashRegisters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SaleOrders_CashSessionId_Status",
                table: "SaleOrders",
                columns: new[] { "CashSessionId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CashRegisters_CompanyId_IsActive",
                table: "CashRegisters",
                columns: new[] { "CompanyId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_CashSessions_CashRegisterId_Status",
                table: "CashSessions",
                columns: new[] { "CashRegisterId", "Status" },
                unique: true,
                filter: "\"Status\" = 'Open'");

            migrationBuilder.CreateIndex(
                name: "IX_CashSessions_CompanyId_OpenedAtUtc",
                table: "CashSessions",
                columns: new[] { "CompanyId", "OpenedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_SaleOrderItems_SaleOrderId",
                table: "SaleOrderItems",
                column: "SaleOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_SalePayments_SaleOrderId",
                table: "SalePayments",
                column: "SaleOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleOrders_CashSessions_CashSessionId",
                table: "SaleOrders",
                column: "CashSessionId",
                principalTable: "CashSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SaleOrders_CashSessions_CashSessionId",
                table: "SaleOrders");

            migrationBuilder.DropTable(
                name: "CashSessions");

            migrationBuilder.DropTable(
                name: "SaleOrderItems");

            migrationBuilder.DropTable(
                name: "SalePayments");

            migrationBuilder.DropTable(
                name: "CashRegisters");

            migrationBuilder.DropIndex(
                name: "IX_SaleOrders_CashSessionId_Status",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CashRegisterId",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CashSessionId",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CompletedAtUtc",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CustomerName",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "CustomerPhone",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "DiscountCents",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "FiscalDecision",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "FiscalDocumentId",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "SubtotalCents",
                table: "SaleOrders");

            migrationBuilder.DropColumn(
                name: "TotalCents",
                table: "SaleOrders");
        }
    }
}
