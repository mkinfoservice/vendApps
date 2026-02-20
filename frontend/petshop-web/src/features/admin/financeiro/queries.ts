import { useQuery } from "@tanstack/react-query";
import { fetchFinanceiro } from "./api";

export function useFinanceiro(period: number) {
  return useQuery({
    queryKey: ["financeiro", period],
    queryFn: () => fetchFinanceiro(period),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
