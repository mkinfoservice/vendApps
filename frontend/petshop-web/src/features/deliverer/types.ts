export type { RouteStatus, RouteStopStatus } from "../admin/routes/types";

export type DelivererStopDto = {
  stopId: string;
  sequence: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  deliveredAtUtc: string | null;
  failureReason: string | null;
};

export type DelivererActiveRoute = {
  hasActiveRoute: boolean;
  routeId: string | null;
  routeNumber: string | null;
  status: string | null;
  totalStops: number;
  completedStops: number;
  remainingStops: number;
  nextStop: DelivererStopDto | null;
};

export type DelivererRouteDetail = {
  routeId: string;
  routeNumber: string;
  status: string;
  totalStops: number;
  completedStops: number;
  nextStopId: string | null;
  nextStop: DelivererStopDto | null;
  stops: DelivererStopDto[];
  depot: { name: string; address: string } | null;
  progress: { done: number; total: number };
};

export type DelivererNextNavigation = {
  nextStopId: string | null;
  customerName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  wazeLink: string | null;
  googleMapsLink: string | null;
  hasCoordinates: boolean;
  routeCompleted: boolean;
};
