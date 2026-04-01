import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketplaceIntegrationDto {
  id: string;
  type: string;           // "IFood"
  merchantId: string;
  displayName: string;
  clientId: string;
  webhookSecret: string | null;
  autoAcceptOrders: boolean;
  autoPrint: boolean;
  isActive: boolean;
  createdAtUtc: string;
  lastOrderReceivedAtUtc: string | null;
  lastCatalogSyncAtUtc: string | null;
  lastErrorMessage: string | null;
  webhookUrl: string;     // URL relativa para configurar no portal iFood
}

export interface UpsertIntegrationRequest {
  type: number;           // 1 = IFood
  merchantId: string;
  clientId: string;
  clientSecret: string;
  displayName: string | null;
  webhookSecret: string | null;
  autoAcceptOrders: boolean;
  autoPrint: boolean;
}

export interface CatalogSyncResult {
  updated: number;
  skipped: number;
  failed: number;
  notFound: string[];
  errorMessage: string | null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function listIntegrations(): Promise<MarketplaceIntegrationDto[]> {
  return adminFetch<MarketplaceIntegrationDto[]>("/admin/marketplace");
}

export async function getIntegration(id: string): Promise<MarketplaceIntegrationDto> {
  return adminFetch<MarketplaceIntegrationDto>(`/admin/marketplace/${id}`);
}

export async function createIntegration(
  req: UpsertIntegrationRequest,
): Promise<MarketplaceIntegrationDto> {
  return adminFetch<MarketplaceIntegrationDto>("/admin/marketplace", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function updateIntegration(
  id: string,
  req: UpsertIntegrationRequest,
): Promise<MarketplaceIntegrationDto> {
  return adminFetch<MarketplaceIntegrationDto>(`/admin/marketplace/${id}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function deactivateIntegration(id: string): Promise<void> {
  await adminFetch<void>(`/admin/marketplace/${id}`, { method: "DELETE" });
}

export async function syncCatalog(id: string): Promise<CatalogSyncResult> {
  return adminFetch<CatalogSyncResult>(`/admin/marketplace/${id}/sync-catalog`, {
    method: "POST",
  });
}
