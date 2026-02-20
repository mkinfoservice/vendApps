import { adminFetch } from "@/features/admin/auth/adminFetch";

export type DailyStatDto = {
  date: string;         // "2026-02-12"
  revenueCents: number;
  deliveries: number;
  failures: number;
};

export type DelivererCommissionDto = {
  delivererName: string;
  totalDeliveries: number;
  commissionCents: number;
  perDeliveryCents: number;
};

export type FinanceiroResponse = {
  period: number;
  totalRevenueCents: number;
  totalDeliveries: number;
  avgPerDeliveryCents: number;
  totalFailures: number;
  dailyStats: DailyStatDto[];
  delivererCommissions: DelivererCommissionDto[];
};

export async function fetchFinanceiro(period: number): Promise<FinanceiroResponse> {
  return adminFetch<FinanceiroResponse>(`/admin/financeiro?period=${period}`);
}
