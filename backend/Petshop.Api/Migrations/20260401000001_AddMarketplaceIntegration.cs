using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketplaceIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MarketplaceIntegrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    MerchantId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ClientId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ClientSecretEncrypted = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    WebhookSecret = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AutoAcceptOrders = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    AutoPrint = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastOrderReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastCatalogSyncAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastErrorMessage = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketplaceIntegrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MarketplaceIntegrations_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MarketplaceOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MarketplaceIntegrationId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalOrderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExternalStatus = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    LastCallbackStatus = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastCallbackAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RawPayloadJson = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketplaceOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MarketplaceOrders_MarketplaceIntegrations_MarketplaceIntegrationId",
                        column: x => x.MarketplaceIntegrationId,
                        principalTable: "MarketplaceIntegrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MarketplaceOrders_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MarketplaceIntegrations_CompanyId",
                table: "MarketplaceIntegrations",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_MarketplaceIntegrations_Type_MerchantId",
                table: "MarketplaceIntegrations",
                columns: new[] { "Type", "MerchantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MarketplaceOrders_MarketplaceIntegrationId_ExternalOrderId",
                table: "MarketplaceOrders",
                columns: new[] { "MarketplaceIntegrationId", "ExternalOrderId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MarketplaceOrders_OrderId",
                table: "MarketplaceOrders",
                column: "OrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "MarketplaceOrders");
            migrationBuilder.DropTable(name: "MarketplaceIntegrations");
        }
    }
}
