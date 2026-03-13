using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFiscalFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FiscalAuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OldStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    NewStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Details = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiscalAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FiscalConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cnpj = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: false),
                    InscricaoEstadual = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    TaxRegime = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SefazEnvironment = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CertificatePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CertificatePassword = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CscId = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CscToken = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    NfceSerie = table.Column<short>(type: "smallint", nullable: false),
                    DefaultCfop = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiscalConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FiscalConfigs_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FiscalDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Serie = table.Column<short>(type: "smallint", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    AccessKey = table.Column<string>(type: "character varying(44)", maxLength: 44, nullable: true),
                    FiscalStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ContingencyType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    XmlContent = table.Column<string>(type: "text", nullable: true),
                    XmlProtocol = table.Column<string>(type: "text", nullable: true),
                    AuthorizationCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AuthorizationDateTimeUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    RejectMessage = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TransmissionAttempts = table.Column<int>(type: "integer", nullable: false),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiscalDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FiscalDocuments_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NfceNumberControls",
                columns: table => new
                {
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Serie = table.Column<short>(type: "smallint", nullable: false),
                    NextNumber = table.Column<int>(type: "integer", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NfceNumberControls", x => new { x.CompanyId, x.Serie });
                });

            migrationBuilder.CreateTable(
                name: "FiscalQueues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    FiscalDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ScheduledForUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    FailureReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiscalQueues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FiscalQueues_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FiscalQueues_FiscalDocuments_FiscalDocumentId",
                        column: x => x.FiscalDocumentId,
                        principalTable: "FiscalDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FiscalAuditLogs_CompanyId_CreatedAtUtc",
                table: "FiscalAuditLogs",
                columns: new[] { "CompanyId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_FiscalAuditLogs_EntityType_EntityId",
                table: "FiscalAuditLogs",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_FiscalConfigs_CompanyId",
                table: "FiscalConfigs",
                column: "CompanyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FiscalDocuments_AccessKey",
                table: "FiscalDocuments",
                column: "AccessKey",
                unique: true,
                filter: "\"AccessKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_FiscalDocuments_CompanyId_FiscalStatus",
                table: "FiscalDocuments",
                columns: new[] { "CompanyId", "FiscalStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_FiscalQueues_CompanyId_Status",
                table: "FiscalQueues",
                columns: new[] { "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FiscalQueues_FiscalDocumentId",
                table: "FiscalQueues",
                column: "FiscalDocumentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FiscalAuditLogs");

            migrationBuilder.DropTable(
                name: "FiscalConfigs");

            migrationBuilder.DropTable(
                name: "FiscalQueues");

            migrationBuilder.DropTable(
                name: "NfceNumberControls");

            migrationBuilder.DropTable(
                name: "FiscalDocuments");
        }
    }
}
