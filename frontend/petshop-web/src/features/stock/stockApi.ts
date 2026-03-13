import { adminFetch } from "@/features/admin/auth/adminFetch";
import type { StockMovementType } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StockItemDto {
  id: string;
  name: string;
  barcode: string | null;
  internalCode: string | null;
  unit: string;
  isSoldByWeight: boolean;
  stockQty: number;
  reorderPoint: number | null;
  priceCents: number;
  costCents: number;
  categoryId: string;
}

export interface StockAlertDto {
  id: string;
  name: string;
  unit: string;
  isSoldByWeight: boolean;
  stockQty: number;
  reorderPoint: number | null;
  alertLevel: "out" | "low";
}

export interface StockMovementDto {
  id: string;
  movementType: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string | null;
  saleOrderId: string | null;
  actorName: string | null;
  createdAtUtc: string;
}

export interface StockListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: StockItemDto[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function listStock(
  filter?: "low" | "out",
  page = 1,
  pageSize = 50
): Promise<StockListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter) params.set("filter", filter);
  return adminFetch<StockListResponse>(`/admin/stock?${params}`);
}

export async function getAlerts(): Promise<StockAlertDto[]> {
  return adminFetch<StockAlertDto[]>("/admin/stock/alerts");
}

export async function getMovements(productId: string, page = 1): Promise<StockMovementDto[]> {
  return adminFetch<StockMovementDto[]>(
    `/admin/stock/${productId}/movements?page=${page}&pageSize=30`
  );
}

export async function adjustStock(
  productId: string,
  delta: number,
  movementType: StockMovementType,
  reason?: string
): Promise<{ id: string; balanceBefore: number; balanceAfter: number; newStockQty: number }> {
  return adminFetch(`/admin/stock/${productId}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta, movementType, reason }),
  });
}

export async function setReorderPoint(
  productId: string,
  reorderPoint: number | null
): Promise<void> {
  await adminFetch(`/admin/stock/${productId}/reorder-point`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reorderPoint }),
  });
}
