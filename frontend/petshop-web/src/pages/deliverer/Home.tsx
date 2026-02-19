import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveRoute } from "@/features/deliverer/api";
import {
  getDelivererInfo,
  clearDelivererToken,
} from "@/features/deliverer/auth/auth";
import { LogOut, RefreshCw, MapPin, ChevronRight } from "lucide-react";

export default function DelivererHome() {
  const navigate = useNavigate();
  const info = getDelivererInfo();

  const {
    data: route,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["deliverer", "active-route"],
    queryFn: fetchActiveRoute,
  });

  function logout() {
    clearDelivererToken();
    navigate("/deliverer/login", { replace: true });
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <div className="text-sm text-zinc-400">Entregador</div>
          <div className="font-bold">{info?.name ?? "..."}</div>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-20 text-zinc-500">Carregando...</div>
        ) : !route?.hasActiveRoute ? (
          /* Sem rota */
          <div className="text-center py-16 space-y-4">
            <MapPin size={48} className="mx-auto text-zinc-600" />
            <div>
              <div className="text-lg font-bold text-zinc-300">
                Nenhuma rota atribuida
              </div>
              <div className="text-sm text-zinc-500 mt-1">
                Aguarde o admin criar sua rota de entrega.
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        ) : (
          /* Com rota */
          <div className="space-y-4">
            {/* Card da rota */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">{route.routeNumber}</div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    route.status === "EmAndamento"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {route.status === "EmAndamento"
                    ? "Em Andamento"
                    : "Aguardando Inicio"}
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Progresso</span>
                  <span>
                    {route.completedStops}/{route.totalStops} entregas
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${
                        route.totalStops > 0
                          ? (route.completedStops / route.totalStops) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Proxima parada */}
              {route.nextStop && (
                <div className="border-t border-zinc-800 pt-3">
                  <div className="text-xs text-zinc-500 mb-1">
                    Proxima parada
                  </div>
                  <div className="font-semibold">
                    #{route.nextStop.sequence} {route.nextStop.customerName}
                  </div>
                  <div className="text-sm text-zinc-400 truncate">
                    {route.nextStop.address}
                  </div>
                </div>
              )}

              {/* Botao ver rota */}
              <button
                onClick={() => navigate(`/deliverer/route/${route.routeId}`)}
                className="w-full h-12 rounded-xl bg-white text-black font-bold text-base flex items-center justify-center gap-2"
              >
                Ver Rota
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Refresh */}
            <div className="text-center">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-xs text-zinc-500 inline-flex items-center gap-1"
              >
                <RefreshCw
                  size={12}
                  className={isFetching ? "animate-spin" : ""}
                />
                Atualizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
