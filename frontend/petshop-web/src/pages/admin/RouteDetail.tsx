import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  fetchRouteById,
  startRoute,
  markStopDelivered,
  failStop,
} from "@/features/admin/routes/api";
import {
  canDeliverStop,
  canFailStop,
  canStartRoute,
  ROUTE_STATUS_LABEL,
  STOP_STATUS_LABEL,
} from "@/features/admin/routes/status";
import { NavigationButtons } from "@/features/admin/routes/components/NavigationButtons";
import type { RouteStatus, RouteStopStatus } from "@/features/admin/routes/types";
import { ArrowLeft, Play, MapPin, Clock, User, Truck } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

const ROUTE_STATUS_STYLE: Record<RouteStatus, { badge: string; dot: string }> = {
  Criada:      { badge: "bg-zinc-700/40 text-zinc-300",       dot: "#94a3b8" },
  Atribuida:   { badge: "bg-blue-500/20 text-blue-400",       dot: "#3b82f6" },
  EmAndamento: { badge: "bg-amber-500/20 text-amber-400",     dot: "#f59e0b" },
  Concluida:   { badge: "bg-emerald-500/20 text-emerald-400", dot: "#10b981" },
  Cancelada:   { badge: "bg-red-500/20 text-red-400",         dot: "#ef4444" },
};

const STOP_STATUS_STYLE: Record<RouteStopStatus, { badge: string }> = {
  Pendente: { badge: "bg-zinc-700/40 text-zinc-300" },
  Proxima:  { badge: "bg-blue-500/20 text-blue-400" },
  Entregue: { badge: "bg-emerald-500/20 text-emerald-400" },
  Falhou:   { badge: "bg-red-500/20 text-red-400" },
  Ignorada: { badge: "bg-zinc-700/40 text-zinc-400" },
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3 flex items-start gap-3"
      style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#7c5cf8]/15 text-[#9b7efa]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</div>
        <div className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--text)" }}>{value}</div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RouteDetail() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const { routeId } = useParams();
  const id = routeId ?? "";

  const [failReason, setFailReason] = useState<Record<string, string>>({});

  const qKey = useMemo(() => ["route", id], [id]);

  const q = useQuery({
    queryKey: qKey,
    queryFn: () => fetchRouteById(id),
    enabled: !!id,
  });

  const startMut = useMutation({
    mutationFn: () => startRoute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const deliveredMut = useMutation({
    mutationFn: ({ stopId }: { stopId: string }) => markStopDelivered(id, stopId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const failMut = useMutation({
    mutationFn: ({ stopId, reason }: { stopId: string; reason: string }) =>
      failStop(id, stopId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const data = q.data;

  const completedStops = data?.stops.filter(
    (s) => s.status === "Entregue" || s.status === "Falhou" || s.status === "Ignorada"
  ).length ?? 0;

  const progressPct = data && data.totalStops > 0
    ? Math.round((completedStops / data.totalStops) * 100)
    : 0;

  const routeCfg = data ? (ROUTE_STATUS_STYLE[data.status as RouteStatus] ?? ROUTE_STATUS_STYLE.Criada) : null;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => nav("/admin/routes")}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {data?.routeNumber ?? "Detalhe da rota"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Acompanhe e gerencie as paradas
            </p>
          </div>
          {data && routeCfg && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${routeCfg.badge}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: routeCfg.dot }} />
              {ROUTE_STATUS_LABEL[data.status as RouteStatus] ?? data.status}
            </span>
          )}
        </div>

        {q.isLoading && (
          <div className="py-10 text-sm" style={{ color: "var(--text-muted)" }}>Carregando rota...</div>
        )}

        {q.isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
            Erro ao carregar rota.
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* ── Left: stops ─────────────────────────── */}
            <div className="space-y-4">
              {/* Info cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoCard
                  icon={<User size={15} />}
                  label="Entregador"
                  value={data.delivererName ?? "—"}
                />
                <InfoCard
                  icon={<Truck size={15} />}
                  label="Veículo"
                  value={data.delivererVehicle ?? "—"}
                />
                <InfoCard
                  icon={<Play size={15} />}
                  label="Início"
                  value={fmtDate(data.startedAtUtc)}
                />
                <InfoCard
                  icon={<Clock size={15} />}
                  label="Conclusão"
                  value={fmtDate(data.completedAtUtc)}
                />
              </div>

              {/* Progress */}
              <div
                className="rounded-2xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Progresso</span>
                  <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{completedStops}/{data.totalStops}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: progressPct === 100 ? "#10b981" : "#7c5cf8",
                    }}
                  />
                </div>
                <div className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{progressPct}% concluído</div>
              </div>

              {/* Navigation */}
              <NavigationButtons routeId={id} routeStatus={data.status} />

              {/* Start button */}
              {canStartRoute(data.status) && (
                <button
                  className="w-full h-11 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                  disabled={startMut.isPending}
                  onClick={() => startMut.mutate()}
                >
                  <Play size={16} />
                  {startMut.isPending ? "Iniciando..." : "Iniciar rota"}
                </button>
              )}

              {/* Stops */}
              <div className="space-y-3">
                {data.stops.map((s) => {
                  const canDeliver = canDeliverStop(data.status, s.status);
                  const canFail = canFailStop(data.status, s.status);
                  const stopCfg = STOP_STATUS_STYLE[s.status as RouteStopStatus] ?? STOP_STATUS_STYLE.Pendente;

                  return (
                    <div
                      key={s.stopId}
                      className="rounded-2xl border p-4 space-y-3"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
                            >
                              {s.sequence}
                            </span>
                            <span className="font-semibold truncate" style={{ color: "var(--text)" }}>
                              {s.customerName}
                            </span>
                          </div>
                          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            {s.orderNumber} · {s.customerPhone}
                          </div>
                          <div className="flex items-center gap-1 text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            <MapPin size={11} />
                            {s.address}
                          </div>
                          {s.deliveredAtUtc && (
                            <div className="text-xs mt-1 text-emerald-400">
                              Entregue em {fmtDate(s.deliveredAtUtc)}
                            </div>
                          )}
                          {s.failureReason && (
                            <div className="text-xs mt-1 text-red-400">
                              Falha: {s.failureReason}
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${stopCfg.badge}`}>
                          {STOP_STATUS_LABEL[s.status as RouteStopStatus] ?? s.status}
                        </span>
                      </div>

                      {(canDeliver || canFail) && (
                        <div className="flex gap-2 pt-1">
                          <button
                            className="flex-1 h-9 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: "#10b981" }}
                            disabled={!canDeliver || deliveredMut.isPending}
                            onClick={() => deliveredMut.mutate({ stopId: s.stopId })}
                          >
                            Entregue
                          </button>
                          <div className="flex gap-2 flex-1">
                            <input
                              className="h-9 flex-1 rounded-xl border px-3 text-xs outline-none min-w-0"
                              style={{
                                backgroundColor: "var(--surface-2)",
                                borderColor: "var(--border)",
                                color: "var(--text)",
                              }}
                              placeholder="Motivo da falha..."
                              value={failReason[s.stopId] ?? ""}
                              onChange={(e) =>
                                setFailReason((prev) => ({ ...prev, [s.stopId]: e.target.value }))
                              }
                              disabled={!canFail || failMut.isPending}
                            />
                            <button
                              className="h-9 px-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shrink-0"
                              style={{ backgroundColor: "#ef4444" }}
                              disabled={!canFail || failMut.isPending || !(failReason[s.stopId] ?? "").trim()}
                              onClick={() =>
                                failMut.mutate({ stopId: s.stopId, reason: (failReason[s.stopId] ?? "").trim() })
                              }
                            >
                              Falhou
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Right: summary panel ─────────────────── */}
            <div className="space-y-4">
              <div
                className="rounded-2xl border p-5 space-y-4 sticky top-6"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Resumo da rota
                </div>

                <div className="space-y-2">
                  {[
                    { label: "Número", value: data.routeNumber },
                    { label: "Paradas", value: `${data.totalStops}` },
                    { label: "Entregues", value: `${data.stops.filter(s => s.status === "Entregue").length}` },
                    { label: "Falhas", value: `${data.stops.filter(s => s.status === "Falhou").length}` },
                    { label: "Puladas", value: `${data.stops.filter(s => s.status === "Ignorada").length}` },
                    { label: "Pendentes", value: `${data.stops.filter(s => s.status === "Pendente" || s.status === "Proxima").length}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="h-px" style={{ backgroundColor: "var(--border)" }} />

                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Histórico de paradas
                  </div>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {data.stops.map((s) => {
                      const stopCfg = STOP_STATUS_STYLE[s.status as RouteStopStatus] ?? STOP_STATUS_STYLE.Pendente;
                      return (
                        <div
                          key={s.stopId}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                          style={{ backgroundColor: "var(--surface-2)" }}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: "var(--border)", color: "var(--text-muted)" }}
                          >
                            {s.sequence}
                          </span>
                          <span className="flex-1 truncate" style={{ color: "var(--text)" }}>
                            {s.customerName}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${stopCfg.badge}`}>
                            {STOP_STATUS_LABEL[s.status as RouteStopStatus] ?? s.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
