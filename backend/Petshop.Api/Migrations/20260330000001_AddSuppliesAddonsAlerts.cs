using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

namespace Petshop.Api.Migrations;

[Migration("20260330000001_AddSuppliesAddonsAlerts")]
[DbContext(typeof(AppDbContext))]
public class AddSuppliesAddonsAlerts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── Insumos ──────────────────────────────────────────────────────────
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "Supplies" (
                "Id"           uuid         NOT NULL DEFAULT gen_random_uuid(),
                "CompanyId"    uuid         NOT NULL,
                "Name"         varchar(120) NOT NULL,
                "Unit"         varchar(10)  NOT NULL DEFAULT 'UN',
                "Category"     varchar(60),
                "StockQty"     decimal(14,3) NOT NULL DEFAULT 0,
                "MinQty"       decimal(14,3) NOT NULL DEFAULT 0,
                "SupplierName" varchar(120),
                "Notes"        text,
                "IsActive"     boolean      NOT NULL DEFAULT true,
                "CreatedAtUtc" timestamptz  NOT NULL DEFAULT now(),
                "UpdatedAtUtc" timestamptz,
                CONSTRAINT "PK_Supplies" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_Supplies_Companies" FOREIGN KEY ("CompanyId")
                    REFERENCES "Companies"("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_Supplies_CompanyId" ON "Supplies" ("CompanyId");
            """);

        // ── Adicionais de Produto ────────────────────────────────────────────
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "ProductAddons" (
                "Id"          uuid         NOT NULL DEFAULT gen_random_uuid(),
                "ProductId"   uuid         NOT NULL,
                "Name"        varchar(100) NOT NULL,
                "PriceCents"  int          NOT NULL DEFAULT 0,
                "SortOrder"   int          NOT NULL DEFAULT 0,
                "IsActive"    boolean      NOT NULL DEFAULT true,
                "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ProductAddons" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ProductAddons_Products" FOREIGN KEY ("ProductId")
                    REFERENCES "Products"("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_ProductAddons_ProductId" ON "ProductAddons" ("ProductId");
            """);

        // ── HasAddons + IsSupply no Produto ──────────────────────────────────
        migrationBuilder.Sql("""
            ALTER TABLE "Products"
                ADD COLUMN IF NOT EXISTS "HasAddons" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "IsSupply"  boolean NOT NULL DEFAULT false;
            """);

        // ── Adicionais selecionados por item de venda ────────────────────────
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "SaleOrderItemAddons" (
                "Id"                 uuid         NOT NULL DEFAULT gen_random_uuid(),
                "SaleOrderItemId"    uuid         NOT NULL,
                "AddonId"            uuid         NOT NULL,
                "NameSnapshot"       varchar(100) NOT NULL,
                "PriceCentsSnapshot" int          NOT NULL,
                CONSTRAINT "PK_SaleOrderItemAddons" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_SaleOrderItemAddons_SaleOrderItems" FOREIGN KEY ("SaleOrderItemId")
                    REFERENCES "SaleOrderItems"("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_SaleOrderItemAddons_SaleOrderItemId" ON "SaleOrderItemAddons" ("SaleOrderItemId");
            """);

        // ── Alertas do Admin ─────────────────────────────────────────────────
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "AdminAlerts" (
                "Id"          uuid         NOT NULL DEFAULT gen_random_uuid(),
                "CompanyId"   uuid         NOT NULL,
                "AlertType"   varchar(40)  NOT NULL DEFAULT 'custom',
                "Title"       varchar(200) NOT NULL,
                "Message"     text         NOT NULL,
                "ReferenceId" uuid,
                "IsRead"      boolean      NOT NULL DEFAULT false,
                "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
                "ReadAtUtc"   timestamptz,
                CONSTRAINT "PK_AdminAlerts" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_AdminAlerts_CompanyId_IsRead" ON "AdminAlerts" ("CompanyId", "IsRead");
            """);

        // ── Config global WhatsApp (singleton) ──────────────────────────────
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "PlatformWhatsappConfigs" (
                "Id"                   uuid         NOT NULL DEFAULT gen_random_uuid(),
                "WabaId"               varchar(50),
                "PhoneNumberId"        varchar(50),
                "AccessTokenEncrypted" text,
                "TemplateLanguageCode" varchar(10)  NOT NULL DEFAULT 'pt_BR',
                "IsActive"             boolean      NOT NULL DEFAULT false,
                "CreatedAtUtc"         timestamptz  NOT NULL DEFAULT now(),
                "UpdatedAtUtc"         timestamptz  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_PlatformWhatsappConfigs" PRIMARY KEY ("Id")
            );
            """);

        // ── WhatsappMode + OwnerAlertPhone na Company ────────────────────────
        migrationBuilder.Sql("""
            ALTER TABLE "Companies"
                ADD COLUMN IF NOT EXISTS "WhatsappMode"     varchar(20) NOT NULL DEFAULT 'none',
                ADD COLUMN IF NOT EXISTS "OwnerAlertPhone"  varchar(20);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Companies"
                DROP COLUMN IF EXISTS "WhatsappMode",
                DROP COLUMN IF EXISTS "OwnerAlertPhone";
            DROP TABLE IF EXISTS "PlatformWhatsappConfigs";
            DROP TABLE IF EXISTS "AdminAlerts";
            ALTER TABLE "SaleOrderItems" DROP COLUMN IF EXISTS "Addons";
            DROP TABLE IF EXISTS "SaleOrderItemAddons";
            ALTER TABLE "Products"
                DROP COLUMN IF EXISTS "HasAddons",
                DROP COLUMN IF EXISTS "IsSupply";
            DROP TABLE IF EXISTS "ProductAddons";
            DROP TABLE IF EXISTS "Supplies";
            """);
    }
}
