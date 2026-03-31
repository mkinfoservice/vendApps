using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations;

/// <inheritdoc />
public partial class AddTables : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── Tables (Mesas) ────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name: "Tables",
            columns: table => new
            {
                Id           = table.Column<Guid>(type: "uuid", nullable: false),
                CompanyId    = table.Column<Guid>(type: "uuid", nullable: false),
                Number       = table.Column<int>(type: "integer", nullable: false),
                Name         = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                Capacity     = table.Column<int>(type: "integer", nullable: false, defaultValue: 4),
                IsActive     = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Tables", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Tables_CompanyId_Number",
            table: "Tables",
            columns: new[] { "CompanyId", "Number" },
            unique: true);

        // ── Orders: TableId + IsTableOrder ────────────────────────────────────
        migrationBuilder.AddColumn<Guid>(
            name: "TableId",
            table: "Orders",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "IsTableOrder",
            table: "Orders",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateIndex(
            name: "IX_Orders_TableId",
            table: "Orders",
            column: "TableId",
            filter: "\"TableId\" IS NOT NULL");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_Orders_TableId", table: "Orders");
        migrationBuilder.DropColumn(name: "TableId",      table: "Orders");
        migrationBuilder.DropColumn(name: "IsTableOrder", table: "Orders");
        migrationBuilder.DropTable(name: "Tables");
    }
}
