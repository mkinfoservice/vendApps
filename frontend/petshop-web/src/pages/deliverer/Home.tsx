import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveRoute } from "@/features/deliverer/api";
import { getDelivererInfo, clearDelivererToken } from "@/features/deliverer/auth/auth";
import { LogOut, RefreshCw, MapPin, ChevronRight, Navigation } from "lucide-react";

export default function DelivererHome() {
  const navigate = useNavigate();
  const info = getDelivererInfo();

  const { data: route, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["deliverer", "active-route"],
    queryFn: fetchActiveRoute,
    refetchInterval: 30_000,
  });

  function logout() {
    clearDelivererToken();
    navigate("/deliverer/login", { replace: true });
  }

  const progress = route?.totalStops && route.totalStops > 0
    ? Math.round((route.completedStops / route.totalStops) * 100)
    : 0;

  const initials = (info?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          >
            {initials}
          </div>
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Entregador</div>
            <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              {info?.name ?? "..."}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : !route?.hasActiveRoute ? (
          /* Sem rota */
          <div className="text-center py-16 space-y-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <MapPin size={28} style={{ color: "var(--text-muted)" }} />
            </div>
            <div>
              <div className="text-base font-bold" style={{ color: "var(--text)" }}>
                Nenhuma rota atribuída
              </div>
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Aguarde o administrador criar sua rota.
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        ) : (
          /* Com rota */
          <div className="space-y-4">
            {/* Route card */}
            <div
              className="rounded-2xl border p-5 space-y-4 shadow-[0_0_30px_rgba(124,92,248,0.1)]"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "#7c5cf8",
              }}
            >
              {/* Route header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold" style={{ color: "var(--text)" }}>
                    {route.routeNumber}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {route.completedStops}/{route.totalStops} entregas concluídas
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    route.status === "EmAndamento"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {route.status === "EmAndamento" ? "Em Andamento" : "Aguardando"}
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                  <span>Progresso</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: progress === 100 ? "#10b981" : "#7c5cf8",
                    }}
                  />
                </div>
              </div>

              {/* Next stop preview */}
              {route.nextStop && (
                <div
                  className="rounded-xl p-3 space-y-1"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#9b7efa]">
                    Próxima parada
                  </div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                    #{route.nextStop.sequence} {route.nextStop.customerName}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {route.nextStop.address}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/deliverer/route/${route.routeId}`)}
                  className="flex-1 h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                >
                  Ver Rota
                  <ChevronRight size={18} />
                </button>
                {route.nextStop?.address && (
                  <a
                    href={`https://waze.com/ul?q=${encodeURIComponent(route.nextStop.address)}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "#9b7efa" }}
                  >
                    <Navigation size={18} />
                  </a>
                )}
              </div>
            </div>

            {/* Refresh */}
            <div className="text-center">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
              >
                <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
                Atualizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
