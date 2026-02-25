import { masterFetch } from "../auth/masterFetch";
import type {
  ListCompaniesResponse,
  CompanyDetailDto,
  CompanySettingsDto,
  ListAdminUsersResponse,
  AdminUserDto,
  WhatsappIntegrationDto,
  ProvisionResultDto,
} from "./types";

// ── Companies ─────────────────────────────────────────────────

export function fetchCompanies(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params.page)     qs.set("page",     String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search)   qs.set("search",   params.search);
  if (params.status)   qs.set("status",   params.status);
  return masterFetch<ListCompaniesResponse>(`/master/companies?${qs}`);
}

export function fetchCompany(id: string) {
  return masterFetch<CompanyDetailDto>(`/master/companies/${id}`);
}

export function createCompany(body: { name: string; slug: string; segment?: string; plan?: string }) {
  return masterFetch<CompanyDetailDto>("/master/companies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCompany(
  id: string,
  body: { name?: string; segment?: string; plan?: string; planExpiresAtUtc?: string | null },
) {
  return masterFetch<CompanyDetailDto>(`/master/companies/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function suspendCompany(id: string, reason?: string) {
  return masterFetch<void>(`/master/companies/${id}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function reactivateCompany(id: string) {
  return masterFetch<void>(`/master/companies/${id}/reactivate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deleteCompany(id: string) {
  return masterFetch<void>(`/master/companies/${id}`, { method: "DELETE" });
}

// ── Settings ──────────────────────────────────────────────────

export function fetchSettings(companyId: string) {
  return masterFetch<CompanySettingsDto>(`/master/companies/${companyId}/settings`);
}

export function updateSettings(
  companyId: string,
  body: Partial<{
    depotLatitude: number;
    depotLongitude: number;
    depotAddress: string;
    coverageRadiusKm: number;
    deliveryFixedCents: number;
    deliveryPerKmCents: number;
    minOrderCents: number;
    enablePix: boolean;
    enableCard: boolean;
    enableCash: boolean;
    pixKey: string;
    printEnabled: boolean;
    printLayout: string;
    supportWhatsappE164: string;
  }>,
) {
  return masterFetch<CompanySettingsDto>(`/master/companies/${companyId}/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ── Admins ────────────────────────────────────────────────────

export function fetchAdmins(companyId: string, includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return masterFetch<ListAdminUsersResponse>(`/master/companies/${companyId}/admins${qs}`);
}

export function createAdmin(
  companyId: string,
  body: { username: string; password: string; email?: string },
) {
  return masterFetch<AdminUserDto>(`/master/companies/${companyId}/admins`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deactivateAdmin(companyId: string, adminId: string) {
  return masterFetch<void>(`/master/companies/${companyId}/admins/${adminId}`, {
    method: "DELETE",
  });
}

export function resetAdminPassword(companyId: string, adminId: string, newPassword: string) {
  return masterFetch<void>(
    `/master/companies/${companyId}/admins/${adminId}/reset-password`,
    { method: "POST", body: JSON.stringify({ newPassword }) },
  );
}

// ── WhatsApp ──────────────────────────────────────────────────

export function fetchWhatsapp(companyId: string) {
  return masterFetch<WhatsappIntegrationDto>(
    `/master/companies/${companyId}/integrations/whatsapp`,
  );
}

export function upsertWhatsapp(
  companyId: string,
  body: {
    mode: string;
    wabaId?: string;
    phoneNumberId?: string;
    accessToken?: string;
    webhookSecret?: string;
    isActive?: boolean;
  },
) {
  return masterFetch<WhatsappIntegrationDto>(
    `/master/companies/${companyId}/integrations/whatsapp`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

// ── Provision ─────────────────────────────────────────────────

export function provisionCompany(
  companyId: string,
  body: {
    adminUsername: string;
    adminPassword: string;
    adminEmail?: string;
    supportWhatsappE164?: string;
    depotAddress?: string;
    deliveryFixedCents?: number;
    minOrderCents?: number;
    enablePix?: boolean;
    enableCard?: boolean;
    enableCash?: boolean;
    seedCategories?: boolean;
    seedProducts?: boolean;
    seedDeliverer?: boolean;
  },
) {
  return masterFetch<ProvisionResultDto>(`/master/companies/${companyId}/provision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
