import { adminFetch } from "@/features/admin/auth/adminFetch";

// TIPOS DA LISTAGEM
export type OrderListItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: string;
  totalCents: number;
  paymentMethodStr: string;
  createdAtUtc: string;
};

export type ListOrdersResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: OrderListItem[];
};

// TIPOS DO DETALHE
export type OrderItem = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  qty: number;
  totalPriceCents: number;
};

export type GetOrderResponse = {
  id: string;
  orderNumber: string;
  status: string;
  name: string;
  phone: string;
  cep: string;
  address: string;
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  paymentMethodStr: string;
  cashGivenCents: number | null;
  changeCents: number | null;
  coupon?: string | null;
  createdAtUtc: string;
  items: OrderItem[];
};

// FUNÇÕES DE API
export async function fetchOrders(
  page = 1,
  pageSize = 20,
  status?: string,
  search?: string
): Promise<ListOrdersResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (status) params.set("status", status);
  if (search) params.set("search", search);

  const qs = params.toString();
  return adminFetch<ListOrdersResponse>(`/orders${qs ? `?${qs}` : ""}`);
}

export async function fetchOrderById(
  idOrNumber: string
): Promise<GetOrderResponse> {
  return adminFetch<GetOrderResponse>(
    `/orders/${encodeURIComponent(idOrNumber)}`
  );
}

export async function updateOrderStatus(
  idOrNumber: string,
  status: string
) {
  return adminFetch(
    `/orders/${encodeURIComponent(idOrNumber)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
}
