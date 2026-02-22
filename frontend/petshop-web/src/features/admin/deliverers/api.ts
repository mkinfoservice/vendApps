import { adminFetch } from "@/features/admin/auth/adminFetch";
import type {
  DelivererResponse,
  CreateDelivererRequest,
  UpdateDelivererRequest,
} from "./type";

export async function fetchDeliverers(params?: { isActive?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.isActive !== undefined) qs.set("isActive", String(params.isActive));
  const url = qs.toString() ? `/deliverers?${qs}` : "/deliverers";
  return adminFetch<DelivererResponse[]>(url);
}

export async function fetchDelivererById(id: string) {
  return adminFetch<DelivererResponse>(`/deliverers/${id}`);
}

export async function createDeliverer(data: CreateDelivererRequest) {
  return adminFetch<DelivererResponse>("/deliverers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateDeliverer(id: string, data: UpdateDelivererRequest) {
  return adminFetch<DelivererResponse>(`/deliverers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteDeliverer(id: string) {
  return adminFetch<void>(`/deliverers/${id}`, {
    method: "DELETE",
  });
}