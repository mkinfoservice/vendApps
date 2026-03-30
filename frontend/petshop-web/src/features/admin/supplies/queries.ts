import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSupply,
  deleteSupply,
  listSupplies,
  updateSupply,
  listSupplyAlerts,
  markSupplyAlertRead,
  markAllSupplyAlertsRead,
  getWhatsappPreferences,
  updateWhatsappPreferences,
  type UpsertSupplyRequest,
  type WhatsappPreferences,
} from "./api";

export function useSupplies(params?: { search?: string; active?: boolean; lowStock?: boolean }) {
  return useQuery({
    queryKey: ["supplies", params],
    queryFn: () => listSupplies(params),
  });
}

export function useCreateSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertSupplyRequest) => createSupply(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplies"] });
      qc.invalidateQueries({ queryKey: ["supply-alerts"] });
    },
  });
}

export function useUpdateSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpsertSupplyRequest }) => updateSupply(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplies"] });
      qc.invalidateQueries({ queryKey: ["supply-alerts"] });
    },
  });
}

export function useDeleteSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSupply(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplies"] });
      qc.invalidateQueries({ queryKey: ["supply-alerts"] });
    },
  });
}

export function useSupplyAlerts(enabled = true) {
  return useQuery({
    queryKey: ["supply-alerts"],
    queryFn: listSupplyAlerts,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkSupplyAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => markSupplyAlertRead(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply-alerts"] }),
  });
}

export function useMarkAllSupplyAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllSupplyAlertsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply-alerts"] }),
  });
}

export function useWhatsappPreferences() {
  return useQuery({
    queryKey: ["whatsapp-preferences"],
    queryFn: getWhatsappPreferences,
  });
}

export function useUpdateWhatsappPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WhatsappPreferences) => updateWhatsappPreferences(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-preferences"] }),
  });
}
