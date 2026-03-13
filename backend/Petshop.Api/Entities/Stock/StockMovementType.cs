namespace Petshop.Api.Entities.Stock;

public enum StockMovementType
{
    InitialSetup    = 0,
    PurchaseEntry   = 1,
    SaleExit        = 2,
    ManualAdjustment= 3,
    Return          = 4,
    Loss            = 5,
}
