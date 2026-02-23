import { adminFetch } from "@/features/admin/auth/adminFetch";
import type {
  CreateSourceRequest,
  DbColumnInfo,
  DbTableInfo,
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

export async function updateSource(id: string, data: { connectionConfigJson?: string }) {
  return adminFetch<void>(`/admin/product-sources/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteSource(id: string): Promise<void> {
  return adminFetch<void>(`/admin/product-sources/${id}`, { method: "DELETE" });
}

export async function fetchDbTables(sourceId: string) {
  return adminFetch<{ tables: DbTableInfo[] }>(
    `/admin/product-sources/${sourceId}/db-schema/tables`
  );
}

export async function fetchDbColumns(sourceId: string, table: string) {
  return adminFetch<{ columns: DbColumnInfo[] }>(
    `/admin/product-sources/${sourceId}/db-schema/columns?table=${encodeURIComponent(table)}`
  );
}
