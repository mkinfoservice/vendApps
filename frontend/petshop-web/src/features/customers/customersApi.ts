import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Customer ──────────────────────────────────────────────────────────────────

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  pointsBalance: number;
  totalOrders: number;
  lastOrderUtc: string | null;
  updatedAtUtc: string;
}

export interface CustomerLookupResult {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  pointsBalance: number;
  email: string | null;
  birthDate: string | null;
}

export interface LoyaltyTxnDto {
  id: string;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  saleOrderId: string | null;
  createdAtUtc: string;
}

export interface CustomerLoyaltyDto {
  customerId: string;
  customerName: string;
  pointsBalance: number;
  totalOrders: number;
  totalSpentCents: number;
  lastOrderUtc: string | null;
  pointsPerReais: number;
  minRedemptionPoints: number;
  transactions: LoyaltyTxnDto[];
}

export interface LoyaltyConfigDto {
  isEnabled: boolean;
  pointsPerReal: number;
  pointsPerReais: number;
  minRedemptionPoints: number;
  maxDiscountPercent: number;
  updatedAtUtc: string;
}

export interface CustomerListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: CustomerListItem[];
}

export async function listCustomers(
  page = 1,
  search?: string,
  pageSize = 30,
  includeSensitive = false,
): Promise<CustomerListResponse> {
  const p = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    includeSensitive: includeSensitive ? "true" : "false",
  });
  if (search) p.set("search", search);
  return adminFetch<CustomerListResponse>(`/admin/customers?${p}`);
}

export async function lookupCustomer(q: string): Promise<CustomerLookupResult> {
  return adminFetch<CustomerLookupResult>(`/admin/customers/lookup?q=${encodeURIComponent(q)}`);
}

export async function getCustomerLoyalty(id: string): Promise<CustomerLoyaltyDto> {
  return adminFetch<CustomerLoyaltyDto>(`/admin/customers/${id}/loyalty`);
}

export async function adjustPoints(id: string, points: number, reason: string): Promise<{ pointsBalance: number }> {
  return adminFetch<{ pointsBalance: number }>(`/admin/customers/${id}/loyalty/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, reason }),
  });
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfigDto> {
  return adminFetch<LoyaltyConfigDto>("/admin/loyalty/config");
}

export async function updateLoyaltyConfig(body: Omit<LoyaltyConfigDto, "updatedAtUtc">): Promise<LoyaltyConfigDto> {
  return adminFetch<LoyaltyConfigDto>("/admin/loyalty/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Loyalty ranking + summary ─────────────────────────────────────────────────

export interface LoyaltyRankingItem {
  id: string;
  name: string;
  phone: string;
  pointsBalance: number;
  totalSpentCents: number;
  totalOrders: number;
  lastOrderUtc: string | null;
}

export interface LoyaltySummary {
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalBalanceOutstanding: number;
  customersWithBalance: number;
}

export interface CustomerLoyaltyDetail {
  customerId: string;
  customerName: string;
  customerPhone: string;
  pointsBalance: number;
  totalSpentCents: number;
  totalOrders: number;
  lastOrderUtc: string | null;
  discountValueCents: number;
  canRedeem: boolean;
  minRedemptionPoints: number;
  transactions: LoyaltyTxnDto[];
}

export async function getLoyaltyRanking(top = 20): Promise<LoyaltyRankingItem[]> {
  return adminFetch<LoyaltyRankingItem[]>(`/admin/loyalty/ranking?top=${top}`);
}

export async function getLoyaltySummary(): Promise<LoyaltySummary> {
  return adminFetch<LoyaltySummary>("/admin/loyalty/summary");
}

export async function getCustomerLoyaltyDetail(customerId: string): Promise<CustomerLoyaltyDetail> {
  return adminFetch<CustomerLoyaltyDetail>(`/admin/loyalty/customers/${customerId}`);
}

export async function adjustLoyaltyPoints(customerId: string, points: number, reason: string): Promise<{ message: string }> {
  return adminFetch<{ message: string }>(`/admin/loyalty/customers/${customerId}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, reason }),
  });
}
