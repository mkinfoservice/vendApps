import { adminFetch } from "@/features/admin/auth/adminFetch";

export type Supply = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  stockQty: number;
  minQty: number;
  supplierName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  isLow: boolean;
};

export type UpsertSupplyRequest = {
  name: string;
  unit?: string | null;
  category?: string | null;
  stockQty: number;
  minQty: number;
  supplierName?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type AdminAlert = {
  id: string;
  alertType: string;
  title: string;
  message: string;
  referenceId: string | null;
  createdAtUtc: string;
};

export type WhatsappPreferences = {
  whatsappMode: "none" | "own" | "platform";
  ownerAlertPhone: string | null;
};

export async function listSupplies(params?: {
  search?: string;
  active?: boolean;
  lowStock?: boolean;
}): Promise<Supply[]> {
  const p = new URLSearchParams();
  if (params?.search) p.set("search", params.search);
  if (params?.active !== undefined) p.set("active", String(params.active));
  if (params?.lowStock) p.set("lowStock", "true");
  const qs = p.toString() ? `?${p.toString()}` : "";
  return adminFetch<Supply[]>(`/admin/supplies${qs}`);
}

export async function createSupply(payload: UpsertSupplyRequest): Promise<Supply> {
  return adminFetch<Supply>("/admin/supplies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupply(id: string, payload: UpsertSupplyRequest): Promise<Supply> {
  return adminFetch<Supply>(`/admin/supplies/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteSupply(id: string): Promise<void> {
  return adminFetch(`/admin/supplies/${id}`, { method: "DELETE" });
}

export async function listSupplyAlerts(): Promise<AdminAlert[]> {
  return adminFetch<AdminAlert[]>("/admin/supplies/alerts");
}

export async function markSupplyAlertRead(alertId: string): Promise<void> {
  return adminFetch(`/admin/supplies/alerts/${alertId}/read`, { method: "POST", body: "{}" });
}

export async function markAllSupplyAlertsRead(): Promise<void> {
  return adminFetch("/admin/supplies/alerts/read-all", { method: "POST", body: "{}" });
}

export async function getWhatsappPreferences(): Promise<WhatsappPreferences> {
  return adminFetch<WhatsappPreferences>("/admin/whatsapp/preferences");
}

export async function updateWhatsappPreferences(payload: WhatsappPreferences): Promise<WhatsappPreferences> {
  return adminFetch<WhatsappPreferences>("/admin/whatsapp/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
