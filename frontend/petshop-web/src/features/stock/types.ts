export type StockMovementType =
  | "InitialSetup"
  | "PurchaseEntry"
  | "ManualAdjustment"
  | "Return"
  | "Loss";

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType | "SaleExit", string> = {
  InitialSetup:     "Estoque inicial",
  PurchaseEntry:    "Entrada (compra)",
  SaleExit:         "Saída (venda)",
  ManualAdjustment: "Ajuste manual",
  Return:           "Devolução",
  Loss:             "Perda / quebra",
};

export const MOVEMENT_TYPE_COLORS: Record<StockMovementType | "SaleExit", string> = {
  InitialSetup:     "bg-blue-100 text-blue-700",
  PurchaseEntry:    "bg-green-100 text-green-700",
  SaleExit:         "bg-gray-100 text-gray-600",
  ManualAdjustment: "bg-yellow-100 text-yellow-700",
  Return:           "bg-purple-100 text-purple-700",
  Loss:             "bg-red-100 text-red-700",
};
