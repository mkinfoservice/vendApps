import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SalesSummary {
  totalRevenueCents: number;
  totalOrders: number;
  avgTicketCents: number;
  totalDiscountCents: number;
  byPaymentMethod: PaymentBreakdown[];
}

export interface PaymentBreakdown {
  method: string;
  count: number;
  totalCents: number;
}

export interface DayRevenue {
  date: string;          // "YYYY-MM-DD"
  revenueCents: number;
  orderCount: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  totalCents: number;
  totalQty: number;
  transactionCount: number;
}

export interface StockValuation {
  totalProducts: number;
  totalValueCents: number;
  outOfStockCount: number;
  lowStockCount: number;
}

export interface FiscalSummary {
  authorized: number;
  rejected: number;
  contingency: number;
  pending: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateRange(from: Date, to: Date) {
  return `from=${fmtDate(from)}&to=${fmtDate(to)}`;
}

export function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function getSalesSummary(from: Date, to: Date): Promise<SalesSummary> {
  return adminFetch<SalesSummary>(`/admin/reports/sales/summary?${dateRange(from, to)}`);
}

export async function getSalesByDay(from: Date, to: Date): Promise<DayRevenue[]> {
  return adminFetch<DayRevenue[]>(`/admin/reports/sales/by-day?${dateRange(from, to)}`);
}

export async function getTopProducts(from: Date, to: Date, limit = 10): Promise<TopProduct[]> {
  return adminFetch<TopProduct[]>(
    `/admin/reports/products/top?${dateRange(from, to)}&limit=${limit}`
  );
}

export async function getStockValuation(): Promise<StockValuation> {
  return adminFetch<StockValuation>("/admin/reports/stock/valuation");
}

export async function getFiscalSummary(from: Date, to: Date): Promise<FiscalSummary> {
  return adminFetch<FiscalSummary>(`/admin/reports/fiscal?${dateRange(from, to)}`);
}
