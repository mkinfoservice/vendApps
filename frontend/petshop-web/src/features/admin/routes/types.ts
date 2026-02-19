export type RouteStatus =
  | "Criada"
  | "Atribuida"
  | "EmAndamento"
  | "Concluida"
  | "Cancelada";

export type RouteStopStatus =
  | "Pendente"
  | "Proxima"
  | "Entregue"
  | "Falhou"
  | "Ignorada";

/* =========================
   LIST
========================= */
export type RoutesListItem = {
  id: string;
  routeNumber: string;
  status: RouteStatus; // ✅ era string
  totalStops: number;
  delivererName: string | null;
  delivererVehicle: string | null;
  createdAtUtc: string;
  startedAtUtc: string | null;
  completedAtUtc: string | null;
};

export type ListRoutesResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: RoutesListItem[];
};

/* =========================
   DETAIL
========================= */
export type RouteStopDetail = {
  stopId: string;
  sequence: number;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: RouteStopStatus; // ✅ era string
  deliveredAtUtc: string | null;
  failedAtUtc?: string | null; // ✅ opcional (se o backend já tiver)
  failureReason?: string | null; // ✅ opcional (se o backend já tiver)
};

export type RouteDetailResponse = {
  id: string;
  routeNumber: string;
  status: RouteStatus; // ✅ era string
  totalStops: number;

  delivererId: string | null;
  delivererName: string | null;
  delivererPhone: string | null;
  delivererVehicle: string | null;

  createdAtUtc: string;
  startedAtUtc: string | null;
  completedAtUtc: string | null;

  stops: RouteStopDetail[];
};

/* =========================
   CREATE ROUTE (POST /routes)
========================= */
export type CreateRouteResponse = {
  routeId: string;
  routeNumber: string;
  totalStops: number;
  stops: Array<{
    stopId: string;
    sequence: number;
    orderNumber: string;
    customerName: string;
    status: RouteStopStatus; // ✅ tipado
  }>;
};

/* =========================
   NAVIGATION
========================= */
export type NavigationStopInfo = {
  sequence: number;
  orderNumber: string;
  customerName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  hasCoordinates: boolean;
};

export type NavigationLinksResponse = {
  routeNumber: string;
  totalStops: number;
  stopsWithCoordinates: number;
  wazeLink: string;
  googleMapsLink: string;
  googleMapsWebLink: string;
  stops: NavigationStopInfo[];
  warnings: string[];
};
