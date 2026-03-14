using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Petshop.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCashRegisterFiscalConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CashRegisterFiscalConfigs",
                columns: table => new
                {
                    Id                  = table.Column<Guid>(type: "uuid", nullable: false),
                    CashRegisterId      = table.Column<Guid>(type: "uuid", nullable: false),
                    Cnpj                = table.Column<string>(maxLength: 14, nullable: false, defaultValue: ""),
                    InscricaoEstadual   = table.Column<string>(maxLength: 30, nullable: false, defaultValue: ""),
                    Uf                  = table.Column<string>(maxLength: 2, nullable: false, defaultValue: ""),
                    RazaoSocial         = table.Column<string>(maxLength: 60, nullable: false, defaultValue: ""),
                    NomeFantasia        = table.Column<string>(maxLength: 60, nullable: true),
                    Logradouro          = table.Column<string>(maxLength: 60, nullable: false, defaultValue: ""),
                    NumeroEndereco      = table.Column<string>(maxLength: 60, nullable: false, defaultValue: ""),
                    Complemento         = table.Column<string>(maxLength: 60, nullable: true),
                    Bairro              = table.Column<string>(maxLength: 60, nullable: false, defaultValue: ""),
                    CodigoMunicipio     = table.Column<int>(type: "integer", nullable: false),
                    NomeMunicipio       = table.Column<string>(maxLength: 60, nullable: false, defaultValue: ""),
                    Cep                 = table.Column<string>(maxLength: 8, nullable: false, defaultValue: ""),
                    Telefone            = table.Column<string>(maxLength: 14, nullable: true),
                    TaxRegime           = table.Column<string>(maxLength: 30, nullable: false, defaultValue: "SimplesNacional"),
                    DefaultCfop         = table.Column<string>(maxLength: 10, nullable: false, defaultValue: "5102"),
                    SefazEnvironment    = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "Homologacao"),
                    CertificateBase64   = table.Column<string>(type: "text", nullable: true),
                    CertificatePassword = table.Column<string>(maxLength: 200, nullable: true),
                    CscId               = table.Column<string>(maxLength: 10, nullable: true),
                    CscToken            = table.Column<string>(maxLength: 36, nullable: true),
                    NfceSerie           = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)1),
                    IsActive            = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAtUtc        = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc        = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashRegisterFiscalConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashRegisterFiscalConfigs_CashRegisters_CashRegisterId",
                        column: x => x.CashRegisterId,
                        principalTable: "CashRegisters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CashRegisterFiscalConfigs_CashRegisterId",
                table: "CashRegisterFiscalConfigs",
                column: "CashRegisterId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CashRegisterFiscalConfigs");
        }
    }
}
