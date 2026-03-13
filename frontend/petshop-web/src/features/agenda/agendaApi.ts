import { adminFetch } from "@/features/admin/auth/adminFetch";

export interface ServiceTypeDto {
  id: string;
  name: string;
  durationMinutes: number;
  defaultPriceCents: number;
  category: string | null;
  isActive: boolean;
}

export type AppointmentStatus =
  | "Scheduled"
  | "CheckedIn"
  | "InProgress"
  | "Done"
  | "Cancelled"
  | "NoShow";

export interface ServiceAppointmentDto {
  id: string;
  serviceTypeId: string;
  serviceTypeName: string;
  serviceTypeCategory: string | null;
  scheduledAt: string;        // "YYYY-MM-DDTHH:mm:ss"
  petName: string;
  petBreed: string | null;
  customerName: string;
  customerPhone: string | null;
  operatorName: string | null;
  status: AppointmentStatus;
  priceCents: number;
  notes: string | null;
  checkedInAt: string | null;
  startedAt: string | null;
  doneAt: string | null;
  cancelledAt: string | null;
  financialEntryId: string | null;
  createdAtUtc: string;
}

// ── Service Types ──────────────────────────────────────────────────────────────

export async function listServiceTypes(): Promise<ServiceTypeDto[]> {
  return adminFetch<ServiceTypeDto[]>("/admin/agenda/service-types");
}

export async function createServiceType(body: {
  name: string;
  durationMinutes: number;
  defaultPriceCents: number;
  category?: string;
}): Promise<ServiceTypeDto> {
  return adminFetch<ServiceTypeDto>("/admin/agenda/service-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateServiceType(
  id: string,
  body: {
    name: string;
    durationMinutes: number;
    defaultPriceCents: number;
    category?: string;
    isActive: boolean;
  }
): Promise<ServiceTypeDto> {
  return adminFetch<ServiceTypeDto>(`/admin/agenda/service-types/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteServiceType(id: string): Promise<void> {
  await adminFetch(`/admin/agenda/service-types/${id}`, { method: "DELETE" });
}

// ── Appointments ───────────────────────────────────────────────────────────────

export async function listAppointments(params?: {
  from?: string;
  to?: string;
  status?: AppointmentStatus | "";
}): Promise<ServiceAppointmentDto[]> {
  const p = new URLSearchParams();
  if (params?.from)   p.set("from",   params.from);
  if (params?.to)     p.set("to",     params.to);
  if (params?.status) p.set("status", params.status);
  const qs = p.toString() ? `?${p}` : "";
  return adminFetch<ServiceAppointmentDto[]>(`/admin/agenda/appointments${qs}`);
}

export async function createAppointment(body: {
  serviceTypeId: string;
  scheduledAt: string;
  petName: string;
  petBreed?: string;
  customerName: string;
  customerPhone?: string;
  operatorName?: string;
  priceCents: number;
  notes?: string;
}): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>("/admin/agenda/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateAppointment(
  id: string,
  body: {
    serviceTypeId: string;
    scheduledAt: string;
    petName: string;
    petBreed?: string;
    customerName: string;
    customerPhone?: string;
    operatorName?: string;
    priceCents: number;
    notes?: string;
  }
): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>(`/admin/agenda/appointments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function checkInAppointment(id: string): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>(`/admin/agenda/appointments/${id}/checkin`, {
    method: "PATCH",
  });
}

export async function startAppointment(id: string): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>(`/admin/agenda/appointments/${id}/start`, {
    method: "PATCH",
  });
}

export async function doneAppointment(id: string): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>(`/admin/agenda/appointments/${id}/done`, {
    method: "PATCH",
  });
}

export async function cancelAppointment(id: string): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>(`/admin/agenda/appointments/${id}/cancel`, {
    method: "PATCH",
  });
}

export async function noShowAppointment(id: string): Promise<ServiceAppointmentDto> {
  return adminFetch<ServiceAppointmentDto>(`/admin/agenda/appointments/${id}/noshow`, {
    method: "PATCH",
  });
}

export async function deleteAppointment(id: string): Promise<void> {
  await adminFetch(`/admin/agenda/appointments/${id}`, { method: "DELETE" });
}
