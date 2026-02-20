import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRouteDetail,
  startRoute,
  markDelivered,
  markFailed,
  markSkipped,
} from "@/features/deliverer/api";
import { NextStopCard } from "@/features/deliverer/components/NextStopCard";
import { StopListItem } from "@/features/deliverer/components/StopListItem";
import { ReasonModal } from "@/features/deliverer/components/ReasonModal";
import { ArrowLeft, Play, PartyPopper } from "lucide-react";

export default function DelivererRouteDetail() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"fail" | "skip" | null>(null);
  const [error, setError] = useState("");

  const { data: route, isLoading } = useQuery({
    queryKey: ["deliverer", "route", routeId],
    queryFn: () => fetchRouteDetail(routeId!),
    enabled: !!routeId,
    refetchInterval: 15_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["deliverer"] });
  }

  async function handleStart() {
    if (!routeId || loading) return;
    try {
      setLoading(true);
      setError("");
      await startRoute(routeId);
      invalidate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar rota.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelivered() {
    if (!routeId || !route?.nextStopId || loading) return;
    try {
      setLoading(true);
      setError("");
      await markDelivered(routeId, route.nextStopId);
      invalidate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao marcar entregue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFail(reason: string) {
    if (!routeId || !route?.nextStopId || loading) return;
    try {
      setLoading(true);
      setError("");
      await markFailed(routeId, route.nextStopId, reason);
      setModal(null);
      invalidate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao marcar falha.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip(reason: string) {
    if (!routeId || !route?.nextStopId || loading) return;
    try {
      setLoading(true);
      setError("");
      await markSkipped(routeId, route.nextStopId, reason);
      setModal(null);
      invalidate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao pular.");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Carregando...</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Rota não encontrada.</div>
      </div>
    );
  }

  const isNotStarted = route.status === "Criada" || route.status === "Atribuida";
  const isCompleted = route.status === "Concluida";
  const progress = route.progress.total > 0
    ? Math.round((route.progress.done / route.progress.total) * 100)
    : 0;

  return (
    <div className="min-h-dvh pb-8" style={{ backgroundColor: "var(--bg)" }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-sm"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/deliverer")}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>
              {route.routeNumber}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {route.progress.done}/{route.progress.total} entregas · {progress}%
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
              route.status === "EmAndamento"
                ? "bg-blue-500/20 text-blue-400"
                : route.status === "Concluida"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {route.status === "EmAndamento"
              ? "Em Andamento"
              : route.status === "Concluida"
              ? "Concluída"
              : "Aguardando"}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? "#10b981" : "#7c5cf8",
            }}
          />
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/30 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Start route */}
        {isNotStarted && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)" }}
          >
            <Play size={20} />
            Iniciar Rota
          </button>
        )}

        {/* Completed */}
        {isCompleted && (
          <div className="text-center py-10 space-y-3">
            <PartyPopper size={48} className="mx-auto text-emerald-400" />
            <div className="text-xl font-bold text-emerald-400">Rota Concluída!</div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Todas as entregas foram processadas.
            </div>
          </div>
        )}

        {/* Next stop card */}
        {route.nextStop && routeId && (
          <NextStopCard
            stop={route.nextStop}
            routeId={routeId}
            onDelivered={handleDelivered}
            onFailed={() => setModal("fail")}
            onSkipped={() => setModal("skip")}
            loading={loading}
          />
        )}

        {/* Stop list */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div
            className="px-4 py-3 text-xs font-bold uppercase tracking-widest border-b"
            style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          >
            Paradas ({route.progress.done}/{route.progress.total})
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {route.stops.map((stop) => (
              <StopListItem
                key={stop.stopId}
                stop={stop}
                isNext={stop.stopId === route.nextStopId}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "fail" && (
        <ReasonModal
          type="fail"
          onConfirm={handleFail}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
      {modal === "skip" && (
        <ReasonModal
          type="skip"
          onConfirm={handleSkip}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
    </div>
  );
}
