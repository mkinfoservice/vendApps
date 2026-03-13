import { adminFetch } from "@/features/admin/auth/adminFetch";

export type PromotionType  = "PercentDiscount" | "FixedAmount";
export type PromotionScope = "All" | "Category" | "Brand" | "Product";
export type PromotionStatus = "active" | "expired" | "scheduled";

export interface PromotionDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  type: PromotionType;
  scope: PromotionScope;
  targetId: string | null;
  targetName: string | null;
  value: number;
  couponCode: string | null;
  minOrderCents: number | null;
  maxDiscountCents: number | null;
  startsAtUtc: string | null;
  expiresAtUtc: string | null;
  createdAtUtc: string;
  status: PromotionStatus;
}

export interface PromotionResult {
  id: string;
  name: string;
  description: string | null;
  couponCode: string | null;
  discountCents: number;
  isAutoApplied: boolean;
}

export async function listPromotions(active?: boolean): Promise<PromotionDto[]> {
  const p = active !== undefined ? `?active=${active}` : "";
  return adminFetch<PromotionDto[]>(`/admin/promotions${p}`);
}

export async function createPromotion(body: Omit<PromotionDto, "id" | "createdAtUtc" | "status">): Promise<PromotionDto> {
  return adminFetch<PromotionDto>("/admin/promotions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updatePromotion(id: string, body: Omit<PromotionDto, "id" | "createdAtUtc" | "status">): Promise<PromotionDto> {
  return adminFetch<PromotionDto>(`/admin/promotions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function togglePromotion(id: string): Promise<{ id: string; isActive: boolean }> {
  return adminFetch<{ id: string; isActive: boolean }>(`/admin/promotions/${id}/toggle`, { method: "PATCH" });
}

export async function deletePromotion(id: string): Promise<void> {
  await adminFetch(`/admin/promotions/${id}`, { method: "DELETE" });
}

export async function evaluatePromotions(totalCents: number, coupon?: string): Promise<PromotionResult[]> {
  const p = new URLSearchParams({ totalCents: String(totalCents) });
  if (coupon) p.set("coupon", coupon);
  return adminFetch<PromotionResult[]>(`/pdv/promotions/evaluate?${p}`);
}
