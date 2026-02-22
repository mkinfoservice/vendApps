import { adminFetch } from "@/features/admin/auth/adminFetch";

export type DelivererListItem = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  isActive: boolean;
  createdAtUtc: string;
};

export async function fetchActiveDeliverers(): Promise<DelivererListItem[]> {
  return adminFetch<DelivererListItem[]>(`/deliverers?isActive=true`);
}

export type ReadyOrderItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  cep: string;
  address: string;
  totalCents: number;
  createdAtUtc: string;
  latitude?: number | null;
  longitude?: number | null;
};

export async function fetchReadyOrders(page = 1, pageSize = 50, search?: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (search) params.set("search", search);

  // ✅ endpoint correto
  return adminFetch<{ total: number; items: ReadyOrderItem[] }>(
    `/orders/ready-for-delivery?${params.toString()}`
  );
}
