import { adminFetch } from "@/features/admin/auth/adminFetch";
import type {
  CustomerListResponse,
  CustomerDetailDto,
  UpsertCustomerRequest,
} from "./types";

export function fetchCustomers(params: {
  phone?: string;
  name?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.phone)    qs.set("phone",    params.phone);
  if (params.name)     qs.set("name",     params.name);
  if (params.page)     qs.set("page",     String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return adminFetch<CustomerListResponse>(`/admin/customers?${qs}`);
}

export function fetchCustomerByPhone(phone: string) {
  return adminFetch<CustomerDetailDto>(`/admin/customers/by-phone/${encodeURIComponent(phone)}`);
}

export async function fetchCustomerByPhoneOrCpf(input: string) {
  const lookup = await adminFetch<{ id: string }>(`/admin/customers/lookup?q=${encodeURIComponent(input)}`);
  return adminFetch<CustomerDetailDto>(`/admin/customers/${lookup.id}`);
}

export function fetchCustomer(id: string) {
  return adminFetch<CustomerDetailDto>(`/admin/customers/${id}`);
}

export function createCustomer(body: UpsertCustomerRequest) {
  return adminFetch<CustomerDetailDto>("/admin/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCustomer(id: string, body: UpsertCustomerRequest) {
  return adminFetch<CustomerDetailDto>(`/admin/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
