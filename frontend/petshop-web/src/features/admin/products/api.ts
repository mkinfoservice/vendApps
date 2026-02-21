import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Tipos ──────────────────────────────────────────────────────────────────

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  internalCode: string | null;
  barcode: string | null;
  categoryName: string | null;
  brandName: string | null;
  unit: string;
  priceCents: number;
  costCents: number;
  marginPercent: number;
  stockQty: number;
  isActive: boolean;
  updatedAtUtc: string | null;
  imageUrl: string | null;
};

export type ProductListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ProductListItem[];
};

export type ProductDetail = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  internalCode: string | null;
  barcode: string | null;
  categoryId: string;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  description: string | null;
  unit: string;
  priceCents: number;
  costCents: number;
  marginPercent: number;
  stockQty: number;
  ncm: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  images: { id: string; url: string; storageProvider: string; isPrimary: boolean; sortOrder: number }[];
  variants: { id: string; variantKey: string; variantValue: string; barcode: string | null; priceCents: number | null; stockQty: number }[];
};

export type CreateProductRequest = {
  name: string;
  slug?: string;
  categoryId: string;
  brandId?: string | null;
  internalCode?: string | null;
  barcode?: string | null;
  description?: string | null;
  unit?: string;
  costCents: number;
  priceCents: number;
  stockQty: number;
  ncm?: string | null;
  isActive?: boolean;
};

export type UpdateProductRequest = Partial<CreateProductRequest>;

// ── Funções de API ─────────────────────────────────────────────────────────

export async function fetchAdminProducts(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  active?: boolean;
}): Promise<ProductListResponse> {
  const qs = new URLSearchParams();
  if (params?.page)      qs.set("page",       String(params.page));
  if (params?.pageSize)  qs.set("pageSize",   String(params.pageSize));
  if (params?.search)    qs.set("search",     params.search);
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  if (params?.active !== undefined) qs.set("active", String(params.active));
  const q = qs.toString();
  return adminFetch<ProductListResponse>(`/admin/products${q ? `?${q}` : ""}`);
}

export async function fetchAdminProductById(id: string): Promise<ProductDetail> {
  return adminFetch<ProductDetail>(`/admin/products/${id}`);
}

export async function createAdminProduct(data: CreateProductRequest): Promise<{ id: string }> {
  return adminFetch<{ id: string }>("/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateAdminProduct(id: string, data: UpdateProductRequest): Promise<void> {
  return adminFetch(`/admin/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function toggleAdminProductStatus(id: string): Promise<void> {
  return adminFetch(`/admin/products/${id}/toggle-status`, { method: "PATCH" });
}

export async function deleteAdminProduct(id: string): Promise<void> {
  return adminFetch(`/admin/products/${id}`, { method: "DELETE" });
}

export async function uploadAdminProductImage(
  id: string,
  file: File
): Promise<{ id: string; url: string; isPrimary: boolean }> {
  const form = new FormData();
  form.append("file", file);
  return adminFetch(`/admin/products/${id}/images`, { method: "POST", body: form });
}

export async function deleteAdminProductImage(id: string, imageId: string): Promise<void> {
  return adminFetch(`/admin/products/${id}/images/${imageId}`, { method: "DELETE" });
}
