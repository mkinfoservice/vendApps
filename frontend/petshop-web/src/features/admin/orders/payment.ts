export type PaymentMethod = "PIX" | "CARD_ON_DELIVERY" | "CASH" | string;

export function paymentLabel(pm: PaymentMethod): string {
  const key = (pm ?? "").trim().toUpperCase();
  if (key === "PIX") return "Pix";
  if (key === "CARD_ON_DELIVERY") return "Cartao na entrega";
  if (key === "CASH") return "Dinheiro";
  if (key === "PAY_AT_COUNTER") return "Pagamento no caixa";
  return key || "-";
}
