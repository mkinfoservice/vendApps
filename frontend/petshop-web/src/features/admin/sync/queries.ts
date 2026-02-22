import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSource, fetchSources, fetchSyncJob, triggerSync } from "./api";

export function useSources() {
  return useQuery({
    queryKey: ["admin-product-sources"],
    queryFn: fetchSources,
  });
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product-sources"] });
    },
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });
}

export function useSyncJob(jobId: string | null) {
  return useQuery({
    queryKey: ["admin-sync-job", jobId],
    queryFn: () => fetchSyncJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "Queued" || status === "Running" ? 2000 : false;
    },
  });
}
