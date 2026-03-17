import { adminFetch } from "@/features/admin/auth/adminFetch";
import type {
  CreateEnrichmentBatchRequest,
  EnrichmentBatchListResponse,
  EnrichmentBatchResponse,
  EnrichmentConfigResponse,
  ImageCandidateListResponse,
  NameSuggestionListResponse,
  UpdateEnrichmentConfigRequest,
} from "./types";

// ── Batches ────────────────────────────────────────────────────────────────────

export function fetchBatches(page = 1, pageSize = 20): Promise<EnrichmentBatchListResponse> {
  return adminFetch<EnrichmentBatchListResponse>(
    `/admin/enrichment/batches?page=${page}&pageSize=${pageSize}`
  );
}

export function fetchBatch(id: string): Promise<EnrichmentBatchResponse> {
  return adminFetch<EnrichmentBatchResponse>(`/admin/enrichment/batches/${id}`);
}

export function createBatch(req: CreateEnrichmentBatchRequest): Promise<EnrichmentBatchResponse> {
  return adminFetch<EnrichmentBatchResponse>("/admin/enrichment/batches", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function reprocessWithoutImage(): Promise<{ batchId: string; totalQueued: number; message: string }> {
  return adminFetch("/admin/enrichment/reprocess-without-image", { method: "POST" });
}

// ── Name suggestions ───────────────────────────────────────────────────────────

export function fetchPendingNames(page = 1, pageSize = 30): Promise<NameSuggestionListResponse> {
  return adminFetch<NameSuggestionListResponse>(
    `/admin/enrichment/review/names?status=Pending&page=${page}&pageSize=${pageSize}`
  );
}

export function approveName(id: string): Promise<void> {
  return adminFetch<void>(`/admin/enrichment/review/names/${id}/approve`, { method: "POST" });
}

export function rejectName(id: string): Promise<void> {
  return adminFetch<void>(`/admin/enrichment/review/names/${id}/reject`, { method: "POST" });
}

export function bulkApproveNames(ids: string[]): Promise<{ approved: number; message: string }> {
  return adminFetch<{ approved: number; message: string }>(
    "/admin/enrichment/review/names/bulk-approve",
    {
      method: "POST",
      body: JSON.stringify({ suggestionIds: ids }),
    }
  );
}

// ── Image candidates ───────────────────────────────────────────────────────────

export function fetchPendingImages(page = 1, pageSize = 20): Promise<ImageCandidateListResponse> {
  return adminFetch<ImageCandidateListResponse>(
    `/admin/enrichment/review/images?status=Pending&page=${page}&pageSize=${pageSize}`
  );
}

export function approveImage(id: string): Promise<{ localUrl: string; message: string }> {
  return adminFetch(`/admin/enrichment/review/images/${id}/approve`, { method: "POST" });
}

export function rejectImage(id: string): Promise<void> {
  return adminFetch<void>(`/admin/enrichment/review/images/${id}/reject`, { method: "POST" });
}

// ── Config ─────────────────────────────────────────────────────────────────────

export function fetchConfig(): Promise<EnrichmentConfigResponse> {
  return adminFetch<EnrichmentConfigResponse>("/admin/enrichment/config");
}

export function updateConfig(req: UpdateEnrichmentConfigRequest): Promise<EnrichmentConfigResponse> {
  return adminFetch<EnrichmentConfigResponse>("/admin/enrichment/config", {
    method: "PUT",
    body: JSON.stringify(req),
  });
}
