namespace Petshop.Api.Entities.Fiscal;

public enum ContingencyType
{
    None,        // sem contingência — transmissão normal
    OfflineXml,  // XML salvo localmente, aguardando reenvio (sem internet)
    SvcAn,       // SEFAZ Virtual de Contingência — Ambiente Nacional
    SvcRs        // SEFAZ Virtual de Contingência — Rio Grande do Sul
}
