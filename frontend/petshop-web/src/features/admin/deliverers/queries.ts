import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDeliverers,
  fetchDelivererById,
  createDeliverer,
  updateDeliverer,
  deleteDeliverer,
} from "./api";

export function useDeliverers(params?: { isActive?: boolean }) {
  return useQuery({
    queryKey: ["admin-deliverers", params ?? {}],
    queryFn: () => fetchDeliverers(params),
  });
}

export function useDeliverer(id: string) {
  return useQuery({
    queryKey: ["admin-deliverer", id],
    queryFn: () => fetchDelivererById(id),
    enabled: !!id,
  });
}

export function useCreateDeliverer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDeliverer,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-deliverers"] });
    },
  });
}

export function useUpdateDeliverer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateDeliverer(id, data),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ["admin-deliverers"] });
      await qc.invalidateQueries({ queryKey: ["admin-deliverer", vars.id] });
    },
  });
}

export function useDeleteDeliverer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDeliverer,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-deliverers"] });
    },
  });
}