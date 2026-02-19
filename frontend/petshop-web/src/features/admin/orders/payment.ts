export type PaymentMethod = "PIX" | "CARD_ON_DELIVERY" | "CASH" | string;

export function paymentLabel(pm: PaymentMethod): string {
  const key = (pm ?? "").trim().toUpperCase();
  if (key === "PIX") return "Pix";
  if (key === "CARD_ON_DELIVERY") return "Cartão na entrega";
  if (key === "CASH") return "Dinheiro";
  return key || "-";
}
