using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFiscalPhase5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Bairro",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Cep",
                table: "FiscalConfigs",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "CodigoMunicipio",
                table: "FiscalConfigs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Complemento",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Logradouro",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NomeFantasia",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomeMunicipio",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NumeroEndereco",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RazaoSocial",
                table: "FiscalConfigs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Telefone",
                table: "FiscalConfigs",
                type: "character varying(14)",
                maxLength: 14,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Bairro",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "Cep",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "CodigoMunicipio",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "Complemento",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "Logradouro",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "NomeFantasia",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "NomeMunicipio",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "NumeroEndereco",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "RazaoSocial",
                table: "FiscalConfigs");

            migrationBuilder.DropColumn(
                name: "Telefone",
                table: "FiscalConfigs");
        }
    }
}
