using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMasterAdminTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Plan",
                table: "Companies",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PlanExpiresAtUtc",
                table: "Companies",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SuspendedAtUtc",
                table: "Companies",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuspendedReason",
                table: "Companies",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AdminUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    Username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PasswordHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByMasterUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdminUsers_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CompanyIntegrationsWhatsapp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    WabaId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PhoneNumberId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    AccessTokenEncrypted = table.Column<string>(type: "text", nullable: true),
                    WebhookSecret = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    NotifyOnStatuses = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanyIntegrationsWhatsapp", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CompanyIntegrationsWhatsapp_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CompanySettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepotLatitude = table.Column<double>(type: "double precision", nullable: true),
                    DepotLongitude = table.Column<double>(type: "double precision", nullable: true),
                    DepotAddress = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CoverageRadiusKm = table.Column<double>(type: "double precision", nullable: true),
                    CoveragePolygonGeoJson = table.Column<string>(type: "text", nullable: true),
                    BlockedZonesGeoJson = table.Column<string>(type: "text", nullable: true),
                    DeliveryFixedCents = table.Column<int>(type: "integer", nullable: true),
                    DeliveryPerKmCents = table.Column<int>(type: "integer", nullable: true),
                    MinOrderCents = table.Column<int>(type: "integer", nullable: true),
                    EnablePix = table.Column<bool>(type: "boolean", nullable: false),
                    EnableCard = table.Column<bool>(type: "boolean", nullable: false),
                    EnableCash = table.Column<bool>(type: "boolean", nullable: false),
                    PixKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PrintEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PrintLayout = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SupportWhatsappE164 = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanySettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CompanySettings_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MasterAuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUsername = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TargetType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TargetId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TargetName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MasterAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminUsers_CompanyId",
                table: "AdminUsers",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminUsers_Username",
                table: "AdminUsers",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CompanyIntegrationsWhatsapp_CompanyId",
                table: "CompanyIntegrationsWhatsapp",
                column: "CompanyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CompanySettings_CompanyId",
                table: "CompanySettings",
                column: "CompanyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MasterAuditLogs_CreatedAtUtc",
                table: "MasterAuditLogs",
                column: "CreatedAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminUsers");

            migrationBuilder.DropTable(
                name: "CompanyIntegrationsWhatsapp");

            migrationBuilder.DropTable(
                name: "CompanySettings");

            migrationBuilder.DropTable(
                name: "MasterAuditLogs");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Plan",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PlanExpiresAtUtc",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SuspendedAtUtc",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SuspendedReason",
                table: "Companies");
        }
    }
}
