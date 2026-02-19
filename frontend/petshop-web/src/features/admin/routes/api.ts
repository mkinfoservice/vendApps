import { adminFetch } from "@/features/admin/auth/adminFetch";
import type { ListRoutesResponse, RouteDetailResponse, NavigationLinksResponse } from "./types";

export type CreateRouteResponse = {
  routeId: string;
  routeNumber: string;
  totalStops: number;
  stops: Array<{
    stopId: string;
    sequence: number;
    orderNumber: string;
    customerName: string;
    status: string;
  }>;
};

// ✅ Tipos para Preview de Rotas Bidirecionais
export type PreviewOrderDto = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  sequence: number;
  classification: string;
  distanceFromDepotKm: number;
};

export type PreviewRouteDto = {
  side: string;
  direction: string;
  totalStops: number;
  estimatedDistanceKm: number;
  orders: PreviewOrderDto[];
};

export type PreviewRouteResponse = {
  routeA: PreviewRouteDto | null;
  routeB: PreviewRouteDto | null;
  unknownOrders: PreviewOrderDto[];
  warnings: string[];
  summary: {
    totalOrdersRequested: number;
    totalOrdersValid: number;
    routeAStops: number;
    routeBStops: number;
    depotAddress: string;
    deliveryRadiusKm: number;
  };
};

export async function fetchRoutes(
  page = 1,
  pageSize = 20,
  status?: string
): Promise<ListRoutesResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (status) params.set("status", status);
  return adminFetch<ListRoutesResponse>(`/routes?${params.toString()}`);
}

export async function fetchRouteById(routeId: string): Promise<RouteDetailResponse> {
  return adminFetch<RouteDetailResponse>(`/routes/${routeId}`);
}

export async function startRoute(routeId: string) {
  return adminFetch(`/routes/${routeId}/start`, { method: "PATCH" });
}

export async function markStopDelivered(routeId: string, stopId: string) {
  return adminFetch(`/routes/${routeId}/stops/${stopId}/delivered`, { method: "PATCH" });
}

export async function failStop(routeId: string, stopId: string, reason: string) {
  return adminFetch(`/routes/${routeId}/stops/${stopId}/fail`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function createRoute(payload: {
  delivererId: string;
  orderIds: string[];
  routeSide?: string; // ✅ NOVO: "A", "B" ou undefined
}) {
  return adminFetch<CreateRouteResponse>(`/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ✅ NOVO: Preview de Rotas Bidirecionais
export async function previewRoutes(orderIds: string[]): Promise<PreviewRouteResponse> {
  return adminFetch<PreviewRouteResponse>(`/routes/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderIds }),
  });
}

export async function fetchNavigationLinks(routeId: string): Promise<NavigationLinksResponse> {
  return adminFetch<NavigationLinksResponse>(`/routes/${routeId}/navigation`);
}
