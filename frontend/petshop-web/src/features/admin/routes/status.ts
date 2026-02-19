import type { RouteStatus, RouteStopStatus } from "./types";

export const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  Criada: "Criada",
  Atribuida: "Atribuída",
  EmAndamento: "Em andamento",
  Concluida: "Concluída",
  Cancelada: "Cancelada",
};

export const STOP_STATUS_LABEL: Record<RouteStopStatus, string> = {
  Pendente: "Pendente",
  Proxima: "Próxima",
  Entregue: "Entregue",
  Falhou: "Falhou",
  Ignorada: "Ignorada",
};

export function canStartRoute(status: string): boolean {
  return status === "Criada";
}

export function canDeliverStop(routeStatus: string, stopStatus: string): boolean {
  if (routeStatus !== "EmAndamento") return false;
  return stopStatus === "Proxima" || stopStatus === "Pendente";
}

export function canFailStop(routeStatus: string, stopStatus: string): boolean {
  if (routeStatus !== "EmAndamento") return false;
  return stopStatus === "Proxima" || stopStatus === "Pendente";
}
export function routeStatusBadgeClass(status: string): string {
  // normaliza: remove espaços e lower
  const raw = (status ?? "").trim();
  const s = raw.replace(/\s+/g, "").toLowerCase();

  const base =
    "border rounded-full px-2 py-0.5 text-xs font-extrabold whitespace-nowrap";

  switch (s) {
    case "criada":
      return `${base} border-zinc-700 bg-zinc-900/60 text-zinc-200`;

    case "atribuida":
      return `${base} border-blue-800 bg-blue-950/40 text-blue-200`;

    case "emandamento":
      return `${base} border-amber-800 bg-amber-950/40 text-amber-200`;

    case "concluida":
      return `${base} border-emerald-800 bg-emerald-950/40 text-emerald-200`;

    case "cancelada":
      return `${base} border-red-800 bg-red-950/40 text-red-200`;

    default:
      return `${base} border-zinc-700 bg-zinc-900/60 text-zinc-200`;
  }
}
export function stopStatusBadgeClass(status: string): string {
  const s = (status ?? "").trim().toLowerCase();

  const base =
    "border rounded-full px-2 py-0.5 text-xs font-extrabold whitespace-nowrap";

  switch (s) {
    case "pendente":
      return `${base} border-zinc-700 bg-zinc-900/60 text-zinc-200`;

    case "proxima":
      return `${base} border-blue-800 bg-blue-950/40 text-blue-200`;

    case "entregue":
      return `${base} border-emerald-800 bg-emerald-950/40 text-emerald-200`;

    case "falhou":
      return `${base} border-red-800 bg-red-950/40 text-red-200`;

    case "ignorada":
      return `${base} border-amber-800 bg-amber-950/40 text-amber-200`;

    default:
      return `${base} border-zinc-700 bg-zinc-900/60 text-zinc-200`;
  }
}
