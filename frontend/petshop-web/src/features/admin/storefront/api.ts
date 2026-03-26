import { adminFetch } from "@/features/admin/auth/adminFetch";
import type {
  StoreFrontConfigResponse,
  UpdateStoreFrontConfigRequest,
  UpsertBannerSlideRequest,
  BannerSlideResponse,
} from "./types";

export function fetchStoreFrontConfig(): Promise<StoreFrontConfigResponse> {
  return adminFetch<StoreFrontConfigResponse>("/admin/storefront");
}

export function updateStoreFrontConfig(
  req: UpdateStoreFrontConfigRequest
): Promise<StoreFrontConfigResponse> {
  return adminFetch<StoreFrontConfigResponse>("/admin/storefront", {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export function addSlide(req: UpsertBannerSlideRequest): Promise<BannerSlideResponse> {
  return adminFetch<BannerSlideResponse>("/admin/storefront/slides", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function updateSlide(
  id: string,
  req: UpsertBannerSlideRequest
): Promise<BannerSlideResponse> {
  return adminFetch<BannerSlideResponse>(`/admin/storefront/slides/${id}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export function deleteSlide(id: string): Promise<void> {
  return adminFetch(`/admin/storefront/slides/${id}`, { method: "DELETE" });
}

export function reorderSlides(orderedIds: string[]): Promise<StoreFrontConfigResponse> {
  return adminFetch<StoreFrontConfigResponse>("/admin/storefront/slides/reorder", {
    method: "POST",
    body: JSON.stringify({ orderedIds }),
  });
}
