import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminProducts,
  fetchAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  toggleAdminProductStatus,
  deleteAdminProduct,
  bulkDeleteAdminProducts,
  deleteWithoutOrders,
  uploadAdminProductImage,
  deleteAdminProductImage,
  fetchProductAddons,
  createProductAddon,
  updateProductAddon,
  deleteProductAddon,
  type CreateProductRequest,
  type UpdateProductRequest,
} from "./api";

export function useAdminProducts(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  active?: boolean;
  withoutOrders?: boolean;
}) {
  return useQuery({
    queryKey: ["admin-products", params],
    queryFn: () => fetchAdminProducts(params),
  });
}

export function useAdminProductById(id: string) {
  return useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => fetchAdminProductById(id),
    enabled: !!id && id !== "new",
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductRequest) => createAdminProduct(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProductRequest) => updateAdminProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
    },
  });
}

export function useToggleProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleAdminProductStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });
}

export function useBulkDeleteProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteAdminProducts(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });
}

export function useDeleteWithoutOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { search?: string; active?: boolean }) => deleteWithoutOrders(params),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });
}

export function useUploadProductImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAdminProductImage(id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-product", id] }); },
  });
}

export function useDeleteProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => deleteAdminProductImage(productId, imageId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-product", productId] }); },
  });
}

export function useProductAddons(productId: string) {
  return useQuery({
    queryKey: ["product-addons", productId],
    queryFn: () => fetchProductAddons(productId),
    enabled: !!productId && productId !== "new",
  });
}

export function useCreateProductAddon(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; priceCents: number; sortOrder?: number }) =>
      createProductAddon(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-addons", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
}

export function useUpdateProductAddon(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ addonId, data }: { addonId: string; data: { name?: string; priceCents?: number; sortOrder?: number; isActive?: boolean } }) =>
      updateProductAddon(productId, addonId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-addons", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
}

export function useDeleteProductAddon(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addonId: string) => deleteProductAddon(productId, addonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-addons", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
}
