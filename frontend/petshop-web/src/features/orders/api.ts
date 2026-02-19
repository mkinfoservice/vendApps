const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

/**
 * Backend (C#) espera:
 * CreateOrderRequest:
 * - name, phone, cep, address
 * - items: [{ productId, qty }]
 * - paymentMethodStr: "PIX" | "CARD_ON_DELIVERY" | "CASH"
 * - cashGivenCents?: number (obrigatório se CASH)
 * - coupon?: string | null
 */

export type PaymentMethodStr = "PIX" | "CARD_ON_DELIVERY" | "CASH";

export type CreateOrderItemRequest = {
  productId: string;
  qty: number; // ✅ alinhado com o C# (Qty)
};

export type CreateOrderRequest = {
  name: string;
  phone: string;
  cep: string;
  address: string;
  complement?: string | null;

  items: CreateOrderItemRequest[];

  // ✅ alinhado com o C# (PaymentMethodStr)
  paymentMethodStr: PaymentMethodStr;

  // ✅ só quando CASH
  cashGivenCents?: number;

  coupon?: string | null;
};

export type CreateOrderResponse = {
  id: string;
  orderNumber: string;
  status: string;
  cartitems: string;

  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;

  paymentMethodStr: string;

  // ✅ no backend são int? então aqui precisa aceitar null
  cashGivenCents: number | null;
  changeCents: number | null;

  coupon?: string | null;
};

export async function CreateOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  const r = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Erro ao criar pedido: ${r.status} ${text}`);
  }

  return r.json();
}
