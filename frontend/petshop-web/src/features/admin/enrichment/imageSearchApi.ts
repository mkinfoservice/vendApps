import { adminFetch } from "@/features/admin/auth/adminFetch";

export type ImageSearchResult = {
  itemId: string;
  title: string;
  pictures: string[];
};

export async function searchImages(q: string): Promise<ImageSearchResult[]> {
  const params = new URLSearchParams({ q });
  return adminFetch<ImageSearchResult[]>(`/admin/enrichment/image-search?${params}`);
}

export async function setProductImage(productId: string, url: string): Promise<void> {
  await adminFetch<unknown>(`/admin/enrichment/products/${productId}/image`, {
    method: "PUT",
    body: JSON.stringify({ url }),
  });
}
