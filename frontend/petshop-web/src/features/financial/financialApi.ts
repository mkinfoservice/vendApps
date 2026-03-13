import { adminFetch } from "@/features/admin/auth/adminFetch";

export type EntryType   = "Receita" | "Despesa";
export type EntryStatus = "paid" | "pending" | "overdue";

export interface FinancialEntryDto {
  id: string;
  type: EntryType;
  title: string;
  amountCents: number;
  dueDate: string;         // "YYYY-MM-DD"
  paidDate: string | null;
  isPaid: boolean;
  category: string | null;
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAtUtc: string;
  status: EntryStatus;
}

export interface EntriesResponse {
  total: number;
  page: number;
  pageSize: number;
  items: FinancialEntryDto[];
}

export interface FinancialSummary {
  from: string;
  to: string;
  paidReceitasCents: number;
  paidDespesasCents: number;
  netPaidCents: number;
  pendReceitasCents: number;
  pendDespesasCents: number;
  netPendingCents: number;
  overdueCount: number;
  byCategory: Array<{
    category: string;
    receitas: number;
    despesas: number;
  }>;
}

export async function listEntries(params?: {
  type?: EntryType;
  status?: EntryStatus | "";
  category?: string;
  from?: string;
  to?: string;
  page?: number;
}): Promise<EntriesResponse> {
  const p = new URLSearchParams();
  if (params?.type)     p.set("type",     params.type);
  if (params?.status)   p.set("status",   params.status);
  if (params?.category) p.set("category", params.category);
  if (params?.from)     p.set("from",     params.from);
  if (params?.to)       p.set("to",       params.to);
  if (params?.page)     p.set("page",     String(params.page));
  const qs = p.toString() ? `?${p}` : "";
  return adminFetch<EntriesResponse>(`/admin/financial/entries${qs}`);
}

export async function getSummary(from?: string, to?: string): Promise<FinancialSummary> {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString() ? `?${p}` : "";
  return adminFetch<FinancialSummary>(`/admin/financial/summary${qs}`);
}

export async function getCategories(): Promise<string[]> {
  return adminFetch<string[]>("/admin/financial/categories");
}

export async function createEntry(body: {
  type: EntryType;
  title: string;
  amountCents: number;
  dueDate: string;
  category?: string;
  notes?: string;
}): Promise<FinancialEntryDto> {
  return adminFetch<FinancialEntryDto>("/admin/financial/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateEntry(
  id: string,
  body: {
    type: EntryType;
    title: string;
    amountCents: number;
    dueDate: string;
    category?: string;
    notes?: string;
  }
): Promise<FinancialEntryDto> {
  return adminFetch<FinancialEntryDto>(`/admin/financial/entries/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function payEntry(id: string, paidDate?: string): Promise<FinancialEntryDto> {
  return adminFetch<FinancialEntryDto>(`/admin/financial/entries/${id}/pay`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paidDate: paidDate ?? null }),
  });
}

export async function unpayEntry(id: string): Promise<FinancialEntryDto> {
  return adminFetch<FinancialEntryDto>(`/admin/financial/entries/${id}/unpay`, {
    method: "PATCH",
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await adminFetch(`/admin/financial/entries/${id}`, { method: "DELETE" });
}
