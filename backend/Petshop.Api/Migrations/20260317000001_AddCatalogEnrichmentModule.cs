using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260317000001_AddCatalogEnrichmentModule")]
    public partial class AddCatalogEnrichmentModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── EnrichmentBatches ─────────────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "EnrichmentBatches",
                columns: table => new
                {
                    Id              = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId       = table.Column<Guid>(type: "uuid", nullable: false),
                    Trigger         = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Manual"),
                    SyncJobId       = table.Column<Guid>(type: "uuid", nullable: true),
                    Status          = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Queued"),
                    TotalQueued     = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Processed       = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    NamesNormalized = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    ImagesApplied   = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    PendingReview   = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    FailedItems     = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    StartedAtUtc    = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAtUtc   = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ErrorMessage    = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc    = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EnrichmentBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EnrichmentBatches_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EnrichmentBatches_ProductSyncJobs_SyncJobId",
                        column: x => x.SyncJobId,
                        principalTable: "ProductSyncJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EnrichmentBatches_CompanyId_Status",
                table: "EnrichmentBatches",
                columns: new[] { "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EnrichmentBatches_CompanyId_CreatedAtUtc",
                table: "EnrichmentBatches",
                columns: new[] { "CompanyId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EnrichmentBatches_SyncJobId",
                table: "EnrichmentBatches",
                column: "SyncJobId",
                filter: "\"SyncJobId\" IS NOT NULL");

            // ── ProductEnrichmentResults ──────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "ProductEnrichmentResults",
                columns: table => new
                {
                    Id             = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId      = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId        = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId      = table.Column<Guid>(type: "uuid", nullable: false),
                    Status         = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Queued"),
                    NameProcessed  = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    ImageProcessed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    FailureReason  = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ProcessedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductEnrichmentResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductEnrichmentResults_EnrichmentBatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "EnrichmentBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductEnrichmentResults_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductEnrichmentResults_BatchId_Status",
                table: "ProductEnrichmentResults",
                columns: new[] { "BatchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductEnrichmentResults_CompanyId_ProductId",
                table: "ProductEnrichmentResults",
                columns: new[] { "CompanyId", "ProductId" });

            // ── ProductNameSuggestions ────────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "ProductNameSuggestions",
                columns: table => new
                {
                    Id                   = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId            = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId            = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId              = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalName         = table.Column<string>(type: "text", nullable: false),
                    SuggestedName        = table.Column<string>(type: "text", nullable: false),
                    NormalizationStepsJson = table.Column<string>(type: "text", nullable: true),
                    ConfidenceScore      = table.Column<decimal>(type: "numeric(5,4)", nullable: false, defaultValue: 0m),
                    Source               = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "DeterministicRules"),
                    Status               = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "Pending"),
                    ReviewedByUserId     = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReviewedAtUtc        = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc         = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductNameSuggestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductNameSuggestions_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductNameSuggestions_EnrichmentBatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "EnrichmentBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductNameSuggestions_CompanyId_Status",
                table: "ProductNameSuggestions",
                columns: new[] { "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductNameSuggestions_ProductId",
                table: "ProductNameSuggestions",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductNameSuggestions_BatchId",
                table: "ProductNameSuggestions",
                column: "BatchId");

            // ── ProductImageCandidates ────────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "ProductImageCandidates",
                columns: table => new
                {
                    Id                 = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId          = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId          = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId            = table.Column<Guid>(type: "uuid", nullable: false),
                    SearchQuery        = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CandidateUrl       = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LocalUrl           = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Source             = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "EanDatabase"),
                    ConfidenceScore    = table.Column<decimal>(type: "numeric(5,4)", nullable: false, defaultValue: 0m),
                    ScoreBreakdownJson = table.Column<string>(type: "text", nullable: true),
                    CandidateName      = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CandidateBrand     = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CandidateBarcode   = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Status             = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "Pending"),
                    ReviewedByUserId   = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReviewedAtUtc      = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttemptedAtUtc     = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc       = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductImageCandidates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductImageCandidates_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductImageCandidates_EnrichmentBatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "EnrichmentBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductImageCandidates_CompanyId_Status",
                table: "ProductImageCandidates",
                columns: new[] { "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductImageCandidates_ProductId",
                table: "ProductImageCandidates",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductImageCandidates_BatchId",
                table: "ProductImageCandidates",
                column: "BatchId");

            // ── EnrichmentConfigs ─────────────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "EnrichmentConfigs",
                columns: table => new
                {
                    Id                      = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId               = table.Column<Guid>(type: "uuid", nullable: false),
                    AutoApplyImageThreshold = table.Column<decimal>(type: "numeric(5,4)", nullable: false, defaultValue: 0.95m),
                    ReviewImageThreshold    = table.Column<decimal>(type: "numeric(5,4)", nullable: false, defaultValue: 0.75m),
                    AutoApplyNameThreshold  = table.Column<decimal>(type: "numeric(5,4)", nullable: false, defaultValue: 1.0m),
                    BatchSize               = table.Column<int>(type: "integer", nullable: false, defaultValue: 50),
                    DelayBetweenItemsMs     = table.Column<int>(type: "integer", nullable: false, defaultValue: 500),
                    EnableImageMatching     = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    EnableNameNormalization = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    UpdatedAtUtc            = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EnrichmentConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EnrichmentConfigs_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EnrichmentConfigs_CompanyId",
                table: "EnrichmentConfigs",
                column: "CompanyId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // A ordem de remoção respeita as FKs: filhos primeiro, depois o pai
            migrationBuilder.DropTable(name: "ProductNameSuggestions");
            migrationBuilder.DropTable(name: "ProductImageCandidates");
            migrationBuilder.DropTable(name: "ProductEnrichmentResults");
            migrationBuilder.DropTable(name: "EnrichmentConfigs");
            migrationBuilder.DropTable(name: "EnrichmentBatches");
        }
    }
}
