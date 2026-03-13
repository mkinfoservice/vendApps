namespace Petshop.Api.Entities.Fiscal;

public enum SefazEnvironment
{
    Homologacao = 2,  // tpAmb = 2 no XML da NFC-e (ambiente de testes)
    Producao = 1      // tpAmb = 1 no XML da NFC-e (ambiente de produção)
}
