using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppTemplateConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NotificationTemplatesJson",
                table: "CompanyIntegrationsWhatsapp",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateLanguageCode",
                table: "CompanyIntegrationsWhatsapp",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotificationTemplatesJson",
                table: "CompanyIntegrationsWhatsapp");

            migrationBuilder.DropColumn(
                name: "TemplateLanguageCode",
                table: "CompanyIntegrationsWhatsapp");
        }
    }
}
