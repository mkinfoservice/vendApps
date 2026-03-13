import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Supplier ──────────────────────────────────────────────────────────────────

export interface SupplierDto {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAtUtc: string;
}

export async function listSuppliers(includeInactive = false): Promise<SupplierDto[]> {
  return adminFetch<SupplierDto[]>(`/admin/suppliers?includeInactive=${includeInactive}`);
}

export async function createSupplier(body: Omit<SupplierDto, "id" | "isActive" | "createdAtUtc">): Promise<SupplierDto> {
  return adminFetch<SupplierDto>("/admin/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateSupplier(id: string, body: Omit<SupplierDto, "id" | "isActive" | "createdAtUtc">): Promise<SupplierDto> {
  return adminFetch<SupplierDto>(`/admin/suppliers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deactivateSupplier(id: string): Promise<void> {
  await adminFetch(`/admin/suppliers/${id}`, { method: "DELETE" });
}

// ── Purchase Orders ───────────────────────────────────────────────────────────

export type PurchaseStatus = "Draft" | "Confirmed" | "Received" | "Cancelled";

export interface PurchaseOrderListItem {
  id: string;
  supplierName: string;
  status: PurchaseStatus;
  invoiceNumber: string | null;
  totalCents: number;
  itemCount: number;
  orderedAtUtc: string | null;
  receivedAtUtc: string | null;
  createdAtUtc: string;
}

export interface PurchaseItemDto {
  id: string;
  productId: string;
  productName: string;
  barcode: string | null;
  qty: number;
  unitCostCents: number;
  totalCents: number;
}

export interface PurchaseOrderDetail {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseStatus;
  invoiceNumber: string | null;
  notes: string | null;
  totalCents: number;
  orderedAtUtc: string | null;
  receivedAtUtc: string | null;
  createdAtUtc: string;
  items: PurchaseItemDto[];
}

export interface PurchaseListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: PurchaseOrderListItem[];
}

export async function listPurchases(
  page = 1, status?: PurchaseStatus, supplierId?: string
): Promise<PurchaseListResponse> {
  const p = new URLSearchParams({ page: String(page), pageSize: "30" });
  if (status) p.set("status", status);
  if (supplierId) p.set("supplierId", supplierId);
  return adminFetch<PurchaseListResponse>(`/admin/purchases?${p}`);
}

export async function getPurchase(id: string): Promise<PurchaseOrderDetail> {
  return adminFetch<PurchaseOrderDetail>(`/admin/purchases/${id}`);
}

export async function createPurchase(body: {
  supplierId: string;
  invoiceNumber?: string;
  notes?: string;
  orderedAtUtc?: string;
}): Promise<{ id: string }> {
  return adminFetch<{ id: string }>("/admin/purchases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updatePurchase(id: string, body: {
  invoiceNumber: string | null;
  notes: string | null;
  orderedAtUtc: string | null;
}): Promise<void> {
  await adminFetch(`/admin/purchases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function addPurchaseItem(purchaseId: string, item: {
  productId: string; qty: number; unitCostCents: number;
}): Promise<void> {
  await adminFetch(`/admin/purchases/${purchaseId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
}

export async function removePurchaseItem(purchaseId: string, itemId: string): Promise<void> {
  await adminFetch(`/admin/purchases/${purchaseId}/items/${itemId}`, { method: "DELETE" });
}

export async function confirmPurchase(id: string): Promise<void> {
  await adminFetch(`/admin/purchases/${id}/confirm`, { method: "POST" });
}

export async function receivePurchase(id: string): Promise<void> {
  await adminFetch(`/admin/purchases/${id}/receive`, { method: "POST" });
}

export async function cancelPurchase(id: string): Promise<void> {
  await adminFetch(`/admin/purchases/${id}/cancel`, { method: "POST" });
}
