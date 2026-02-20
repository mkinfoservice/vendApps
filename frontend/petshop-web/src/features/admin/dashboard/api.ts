import { adminFetch } from "@/features/admin/auth/adminFetch";

export type OrderCountsDto = {
  recebido: number;
  emPreparo: number;
  prontoParaEntrega: number;
  saiuParaEntrega: number;
  entregue: number;
  cancelado: number;
};

export type RouteCountsDto = {
  criada: number;
  atribuida: number;
  emAndamento: number;
  concluida: number;
  cancelada: number;
};

export type DelivererStatsDto = {
  total: number;
  active: number;
  withActiveRoute: number;
};

export type AdminDashboardResponse = {
  orders: OrderCountsDto;
  routes: RouteCountsDto;
  deliverers: DelivererStatsDto;
  readyOrdersWithCoords: number;
  readyOrdersWithoutCoords: number;
  updatedAtUtc: string;
};

export async function fetchDashboard(): Promise<AdminDashboardResponse> {
  return adminFetch<AdminDashboardResponse>("/admin/dashboard");
}
