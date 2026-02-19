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
      <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center">
        Carregando...
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center">
        Rota nao encontrada
      </div>
    );
  }

  const isNotStarted =
    route.status === "Criada" || route.status === "Atribuida";
  const isCompleted = route.status === "Concluida";

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/deliverer")}
            className="p-1 rounded-lg hover:bg-zinc-800"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{route.routeNumber}</div>
            <div className="text-xs text-zinc-400">
              {route.progress.done}/{route.progress.total} entregas
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
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
              ? "Concluida"
              : "Aguardando"}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{
              width: `${
                route.progress.total > 0
                  ? (route.progress.done / route.progress.total) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Iniciar rota */}
        {isNotStarted && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play size={20} />
            Iniciar Rota
          </button>
        )}

        {/* Rota concluida */}
        {isCompleted && (
          <div className="text-center py-8 space-y-3">
            <PartyPopper size={48} className="mx-auto text-emerald-400" />
            <div className="text-xl font-bold text-emerald-400">
              Rota Concluida!
            </div>
            <div className="text-sm text-zinc-400">
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

        {/* Lista de paradas */}
        <div>
          <div className="text-sm font-semibold text-zinc-400 mb-2">
            Paradas ({route.progress.done}/{route.progress.total})
          </div>
          <div className="space-y-1">
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
          title="Motivo da falha"
          actionLabel="Confirmar Falha"
          actionColor="bg-red-600"
          onConfirm={handleFail}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
      {modal === "skip" && (
        <ReasonModal
          title="Motivo para pular"
          actionLabel="Confirmar Pular"
          actionColor="bg-amber-600"
          onConfirm={handleSkip}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
    </div>
  );
}
