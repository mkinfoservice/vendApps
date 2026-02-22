import { adminFetch } from "@/features/admin/auth/adminFetch";
import type {
  CreateSourceRequest,
  ManualSyncRequest,
  SourceListItem,
  SyncJobResponse,
  TestConnectionResponse,
} from "./types";

export async function fetchSources(): Promise<SourceListItem[]> {
  const data = await adminFetch<{ items: SourceListItem[] }>("/admin/product-sources");
  return data.items ?? [];
}

export async function createSource(req: CreateSourceRequest): Promise<{ id: string }> {
  return adminFetch<{ id: string }>("/admin/product-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function testConnection(id: string): Promise<TestConnectionResponse> {
  return adminFetch<TestConnectionResponse>(`/admin/product-sources/${id}/test-connection`, {
    method: "POST",
  });
}

export async function triggerSync(req: ManualSyncRequest): Promise<SyncJobResponse> {
  return adminFetch<SyncJobResponse>("/admin/products/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function fetchSyncJob(jobId: string): Promise<SyncJobResponse> {
  return adminFetch<SyncJobResponse>(`/admin/products/sync/jobs/${jobId}`);
}
