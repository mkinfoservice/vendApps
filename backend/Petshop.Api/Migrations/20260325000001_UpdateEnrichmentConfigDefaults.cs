using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Petshop.Api.Data;

#nullable disable

namespace Petshop.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260325000001_UpdateEnrichmentConfigDefaults")]
public partial class UpdateEnrichmentConfigDefaults : Migration
{
    /// <summary>
    /// Atualiza configs existentes com defaults conservadores (AutoApplyNameThreshold=1.0)
    /// para os novos defaults funcionais (0.70 para nomes, 0.80 para imagens auto-apply).
    /// </summary>
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            UPDATE ""EnrichmentConfigs""
            SET ""AutoApplyNameThreshold""  = 0.70,
                ""EnableImageMatching""     = true,
                ""AutoApplyImageThreshold"" = 0.80,
                ""ReviewImageThreshold""    = 0.40
            WHERE ""AutoApplyNameThreshold"" = 1.0;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            UPDATE ""EnrichmentConfigs""
            SET ""AutoApplyNameThreshold""  = 1.0,
                ""EnableImageMatching""     = false,
                ""AutoApplyImageThreshold"" = 0.95,
                ""ReviewImageThreshold""    = 0.75
            WHERE ""AutoApplyNameThreshold"" = 0.70;
        ");
    }
}
