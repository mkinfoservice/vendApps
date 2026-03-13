namespace Petshop.Api.Entities.Scale;

/// <summary>
/// Modelos de balança suportados pelo Scale Agent.
/// Cada modelo usa um protocolo serial diferente.
/// </summary>
public enum ScaleModel
{
    FilizolaP  = 0,   // Filizola Marte/Plato — protocolo padrão BR
    FilizolaST = 1,   // Filizola ST (modo texto)
    TolVdo     = 2,   // Toledo Prix 3/4 — protocolo VDO
    Generic    = 3,   // Genérico (somente leitura de peso)
}
