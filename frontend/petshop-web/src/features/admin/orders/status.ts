export type OrderStatus =
  | "RECEBIDO"
  | "EM_PREPARO"
  | "PRONTO_PARA_ENTREGA"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  PRONTO_PARA_ENTREGA: "Pronto para entregar",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const NORMAL_FLOW: Record<OrderStatus, OrderStatus | null> = {
  RECEBIDO: "EM_PREPARO",
  EM_PREPARO: "PRONTO_PARA_ENTREGA",
  PRONTO_PARA_ENTREGA: "SAIU_PARA_ENTREGA",
  SAIU_PARA_ENTREGA: "ENTREGUE",
  ENTREGUE: null,
  CANCELADO: null,
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "CANCELADO") return false;
  if (to === "CANCELADO") return true;
  return NORMAL_FLOW[from] === to;
}

export function getNextStatus(current: OrderStatus): OrderStatus | null {
  if (current === "CANCELADO") return null;
  return NORMAL_FLOW[current];
}

export function isFinalStatus(status: OrderStatus): boolean {
  return status === "ENTREGUE" || status === "CANCELADO";
}
