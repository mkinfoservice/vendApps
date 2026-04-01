import { adminFetch } from "@/features/admin/auth/adminFetch";

export type CommissionConfig = {
  id: string;
  companyId: string;
  isEnabled: boolean;
  isTipEnabled: boolean;
  defaultCommissionPercent: number;
  tipDistributionMode: "equal" | "proportional_sales" | "proportional_commission";
  updatedAtUtc: string;
};

export type EmployeeCommissionItem = {
  userId: string;
  username: string;
  role: string;
  isActive: boolean;
  commissionPercent: number;
  hasCustomRate: boolean;
};

export type CommissionSummaryRow = {
  userId: string;
  username: string;
  role: string;
  isActive: boolean;
  commissionPercent: number;
  salesCents: number;
  commissionCents: number;
  tipsCents: number;
  adjustmentsCents: number;
  totalPayableCents: number;
};

export type CommissionSummary = {
  from: string;
  to: string;
  config: CommissionConfig;
  totals: {
    salesCents: number;
    commissionCents: number;
    tipsCents: number;
    adjustmentsCents: number;
    payableCents: number;
    unassignedSalesCents: number;
  };
  employees: CommissionSummaryRow[];
};

export type TipEntry = {
  id: string;
  companyId: string;
  referenceDateUtc: string;
  amountCents: number;
  description: string;
  createdBy: string;
  createdAtUtc: string;
};

export type CommissionAdjustment = {
  id: string;
  companyId: string;
  adminUserId: string;
  referenceDateUtc: string;
  amountCents: number;
  description: string;
  createdBy: string;
  createdAtUtc: string;
};

export function fetchCommissionConfig() {
  return adminFetch<CommissionConfig>("/admin/commissions/config");
}

export function updateCommissionConfig(body: {
  isEnabled?: boolean;
  isTipEnabled?: boolean;
  defaultCommissionPercent?: number;
  tipDistributionMode?: string;
}) {
  return adminFetch<CommissionConfig>("/admin/commissions/config", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function fetchCommissionEmployees() {
  return adminFetch<EmployeeCommissionItem[]>("/admin/commissions/employees");
}

export function setEmployeeRate(userId: string, commissionPercent: number) {
  return adminFetch<{ userId: string; commissionPercent: number; isActive: boolean }>(
    `/admin/commissions/employees/${userId}/rate`,
    {
      method: "PUT",
      body: JSON.stringify({ commissionPercent }),
    },
  );
}

export function resetEmployeeRate(userId: string) {
  return adminFetch<void>(`/admin/commissions/employees/${userId}/rate`, {
    method: "DELETE",
  });
}

export function fetchCommissionSummary(from: string, to: string) {
  const qs = new URLSearchParams({ from, to });
  return adminFetch<CommissionSummary>(`/admin/commissions/summary?${qs.toString()}`);
}

export function fetchTips(from: string, to: string) {
  const qs = new URLSearchParams({ from, to });
  return adminFetch<TipEntry[]>(`/admin/commissions/tips?${qs.toString()}`);
}

export function addTipEntry(body: {
  referenceDateUtc?: string;
  amountCents: number;
  description?: string;
}) {
  return adminFetch<TipEntry>("/admin/commissions/tips", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteTipEntry(id: string) {
  return adminFetch<void>(`/admin/commissions/tips/${id}`, {
    method: "DELETE",
  });
}

export function addCommissionAdjustment(body: {
  userId: string;
  referenceDateUtc?: string;
  amountCents: number;
  description?: string;
}) {
  return adminFetch<CommissionAdjustment>("/admin/commissions/adjustments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteCommissionAdjustment(id: string) {
  return adminFetch<void>(`/admin/commissions/adjustments/${id}`, {
    method: "DELETE",
  });
}
