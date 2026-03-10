import { adminFetch } from "@/features/admin/auth/adminFetch";
import type { PendingJobDto, PrintJobDto } from "./types";

export function fetchPendingPrintJobs() {
  return adminFetch<PendingJobDto[]>("/admin/print/pending");
}

export function markPrinted(jobId: string) {
  return adminFetch<{ marked: boolean }>(`/admin/print/${jobId}/mark-printed`, {
    method: "POST",
  });
}

export function reprintOrder(orderId: string) {
  return adminFetch<{ queued: boolean }>(`/admin/orders/${orderId}/reprint`, {
    method: "POST",
  });
}

export function fetchPrintJobs(limit = 60) {
  return adminFetch<PrintJobDto[]>(`/admin/print/jobs?limit=${limit}`);
}

export function markPrintedById(jobId: string) {
  return adminFetch<{ marked: boolean }>(`/admin/print/${jobId}/mark-printed`, {
    method: "POST",
  });
}
