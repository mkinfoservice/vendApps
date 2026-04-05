import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdvCustomer {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  pointsBalance: number;
}

export async function searchCustomer(query: string): Promise<PdvCustomer | null> {
  const normalized = query.trim();
  const digits = normalized.replace(/\D/g, "");
  if (!normalized || digits.length < 10) return null;
  try {
    return await adminFetch<PdvCustomer>(`/admin/customers/lookup?q=${encodeURIComponent(normalized)}`);
  } catch {
    try {
      if (digits.length >= 10) {
        return await adminFetch<PdvCustomer>(`/admin/customers/by-phone/${encodeURIComponent(digits)}`);
      }
      return null;
    } catch {
      return null;
    }
  }
}

export interface CashRegister {
  id: string;
  name: string;
  fiscalSerie: string;
  fiscalAutoIssuePix: boolean;
  fiscalSendCashToSefaz: boolean;
  isActive: boolean;
}

export interface CashSession {
  id: string;
  cashRegisterId: string;
  registerName: string;
  fiscalSerie: string;
  openedByUserName: string;
  status: "Open" | "Closed";
  openingBalanceCents: number;
  openedAtUtc: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  productBarcodeSnapshot: string | null;
  qty: number;
  unitPriceCentsSnapshot: number;
  totalCents: number;
  isSoldByWeight: boolean;
  weightKg: number | null;
  addons?: Array<{
    id: string;
    addonId: string;
    nameSnapshot: string;
    priceCentsSnapshot: number;
  }>;
}

export interface SalePayment {
  id: string;
  paymentMethod: string;
  amountCents: number;
  changeCents: number;
}

export interface Sale {
  id: string;
  publicId: string;
  cashSessionId: string;
  customerName: string;
  customerPhone: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  status: "Open" | "Completed" | "Cancelled" | "Voided";
  fiscalDecision: string;
  salesQuoteId: string | null;
  notes: string | null;
  createdAtUtc: string;
  completedAtUtc: string | null;
  items: SaleItem[];
  payments: SalePayment[];
}

export interface PdvPromotionResult {
  id: string;
  name: string;
  description: string | null;
  couponCode: string | null;
  discountCents: number;
  isAutoApplied: boolean;
}

export interface CupomData {
  companyName: string;
  publicId: string;
  customerName: string;
  registerName: string;
  createdAtUtc: string;
  completedAtUtc: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  fiscalDecision: string;
  items: Array<{
    productNameSnapshot: string;
    qty: number;
    unitPriceCentsSnapshot: number;
    unitBaseCents?: number;
    totalCents: number;
    isSoldByWeight: boolean;
    weightKg: number | null;
    addons?: Array<{
      nameSnapshot: string;
      priceCentsSnapshot: number;
    }>;
  }>;
  payments: Array<{
    paymentMethod: string;
    amountCents: number;
    changeCents: number;
  }>;
}

// ── Cash Registers ────────────────────────────────────────────────────────────

export async function getCashRegisters(): Promise<CashRegister[]> {
  return adminFetch<CashRegister[]>("/admin/cash-registers");
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function getCurrentSession(): Promise<CashSession | null> {
  return adminFetch<CashSession | null>("/pdv/session/current");
}

export async function openSession(payload: {
  cashRegisterId: string;
  openingBalanceCents?: number;
  notes?: string;
}): Promise<{ id: string; openedAtUtc: string; registerName: string }> {
  return adminFetch("/pdv/session/open", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function closeSession(
  sessionId: string,
  payload: { closingBalanceCents?: number; notes?: string }
): Promise<unknown> {
  return adminFetch(`/pdv/session/${sessionId}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSessionReport(sessionId: string): Promise<unknown> {
  return adminFetch(`/pdv/session/${sessionId}/report`);
}

// ── Sale ──────────────────────────────────────────────────────────────────────

export async function createSale(payload: {
  cashSessionId: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  salesQuoteId?: string;
}): Promise<{ id: string; publicId: string }> {
  return adminFetch("/pdv/sale", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSale(saleId: string): Promise<Sale> {
  return adminFetch<Sale>(`/pdv/sale/${saleId}`);
}

export async function scanBarcode(
  saleId: string,
  barcode: string
): Promise<{
  id: string;
  productNameSnapshot: string;
  qty: number;
  totalCents: number;
  isScaleBarcode: boolean;
}> {
  return adminFetch(`/pdv/sale/${saleId}/scan`, {
    method: "POST",
    body: JSON.stringify({ barcode }),
  });
}

export async function addItem(
  saleId: string,
  payload: { productId: string; qty: number; weightKg?: number; addonIds?: string[]; unitPriceCentsOverride?: number }
): Promise<{ id: string; totalCents: number }> {
  return adminFetch(`/pdv/sale/${saleId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removeItem(saleId: string, itemId: string): Promise<void> {
  return adminFetch(`/pdv/sale/${saleId}/items/${itemId}`, { method: "DELETE" });
}

export async function paySale(
  saleId: string,
  payload: {
    payments: Array<{ paymentMethod: string; amountCents: number }>;
    discountCents?: number;
    notes?: string;
    customerDocument?: string;
    customerPhone?: string;
    customerCpfForLoyalty?: string;
  }
): Promise<{ id: string; publicId: string; totalCents: number; fiscalDecision: string; changeCents: number }> {
  return adminFetch(`/pdv/sale/${saleId}/pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelSale(saleId: string): Promise<unknown> {
  return adminFetch(`/pdv/sale/${saleId}/cancel`, { method: "POST", body: "{}" });
}

export async function getCupom(saleId: string): Promise<CupomData> {
  return adminFetch<CupomData>(`/pdv/sale/${saleId}/cupom`);
}

export async function importDav(
  saleId: string,
  quoteCode: string,
): Promise<{
  id: string;
  itemsAdded: number;
  publicId: string;
  paymentMethod: string | null;
  suggestedAmountCents: number;
  totalCents: number;
}> {
  return adminFetch(`/pdv/sale/${saleId}/import-dav`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteCode }),
  });
}

// ── Movements (Sangria / Suprimento) ──────────────────────────────────────────


export async function evaluateSalePromotions(
  saleId: string,
  coupon?: string
): Promise<PdvPromotionResult[]> {
  const p = new URLSearchParams();
  if (coupon) p.set("coupon", coupon);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return adminFetch<PdvPromotionResult[]>(`/pdv/promotions/evaluate-sale/${saleId}${qs}`);
}
export interface CashMovement {
  id: string;
  type: "Sangria" | "Suprimento";
  amountCents: number;
  description: string;
  operatorName: string;
  createdAtUtc: string;
}

export async function getSessionMovements(sessionId: string): Promise<CashMovement[]> {
  return adminFetch<CashMovement[]>(`/pdv/session/${sessionId}/movements`);
}

export async function addMovement(
  sessionId: string,
  payload: { type: "Sangria" | "Suprimento"; amountCents: number; description?: string }
): Promise<CashMovement> {
  return adminFetch<CashMovement>(`/pdv/session/${sessionId}/movements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Session Report ─────────────────────────────────────────────────────────────

export interface PaymentMethodTotal {
  paymentMethod: string;
  totalCents: number;
}

export interface SessionReport {
  id: string;
  registerName: string;
  openedByUserName: string;
  closedByUserName: string | null;
  status: "Open" | "Closed";
  openingBalanceCents: number;
  closingBalanceCents: number | null;
  openedAtUtc: string;
  closedAtUtc: string | null;
  totalSalesCount: number;
  totalSalesCents: number;
  cancelledSalesCount: number;
  permanentContingencyCount: number;
  byPaymentMethod: PaymentMethodTotal[];
  movements: CashMovement[];
  totalSangriaCents: number;
  totalSuprimentoCents: number;
  expectedCashCents: number;
}

// ── Admin: session history ─────────────────────────────────────────────────────

export interface AdminSession {
  id: string;
  registerName: string;
  openedByUserName: string;
  closedByUserName: string | null;
  status: "Open" | "Closed";
  openingBalanceCents: number;
  closingBalanceCents: number | null;
  totalSalesCount: number;
  totalSalesCents: number;
  permanentContingencyCount: number;
  openedAtUtc: string;
  closedAtUtc: string | null;
}

export interface AdminSessionsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AdminSession[];
}

export async function listAdminSessions(params?: {
  registerId?: string;
  status?: string;
  page?: number;
}): Promise<AdminSessionsResponse> {
  const p = new URLSearchParams();
  if (params?.registerId) p.set("registerId", params.registerId);
  if (params?.status) p.set("status", params.status);
  if (params?.page) p.set("page", String(params.page));
  const qs = p.toString() ? `?${p}` : "";
  return adminFetch<AdminSessionsResponse>(`/admin/pdv/sessions${qs}`);
}

