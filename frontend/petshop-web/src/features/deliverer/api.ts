import { delivererFetch } from "./auth/delivererFetch";
import type {
  DelivererActiveRoute,
  DelivererRouteDetail,
  DelivererNextNavigation,
} from "./types";

export function fetchActiveRoute() {
  return delivererFetch<DelivererActiveRoute>("/deliverer/me/active-route");
}

export function fetchRouteDetail(routeId: string) {
  return delivererFetch<DelivererRouteDetail>(
    `/deliverer/routes/${routeId}`
  );
}

export function startRoute(routeId: string) {
  return delivererFetch(`/deliverer/routes/${routeId}/start`, {
    method: "PATCH",
  });
}

export function markDelivered(routeId: string, stopId: string) {
  return delivererFetch(
    `/deliverer/routes/${routeId}/stops/${stopId}/delivered`,
    { method: "PATCH" }
  );
}

export function markFailed(routeId: string, stopId: string, reason: string) {
  return delivererFetch(
    `/deliverer/routes/${routeId}/stops/${stopId}/fail`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }
  );
}

export function markSkipped(
  routeId: string,
  stopId: string,
  reason?: string
) {
  return delivererFetch(
    `/deliverer/routes/${routeId}/stops/${stopId}/skip`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? "" }),
    }
  );
}

export function fetchNextNavigation(routeId: string) {
  return delivererFetch<DelivererNextNavigation>(
    `/deliverer/routes/${routeId}/navigation/next`
  );
}
