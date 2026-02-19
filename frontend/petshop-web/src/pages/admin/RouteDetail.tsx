import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  routeStatusBadgeClass,
  stopStatusBadgeClass, // ✅ vamos usar (vou te passar abaixo caso ainda não exista)
} from "@/features/admin/routes/status";

import { NavigationButtons } from "@/features/admin/routes/components/NavigationButtons";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function RouteDetail() {
  const nav = useNavigate();
  const qc = useQueryClient();

  // ✅ rota está como /admin/routes/:routeId
  const { routeId } = useParams();
  const id = routeId || "";

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

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      <AdminNav />

      <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Detalhe da rota</div>
            <div className="text-sm text-zinc-300">{data?.routeNumber ?? "—"}</div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => nav("/admin/routes")}>
              Voltar
            </Button>
          </div>
        </div>

        {q.isLoading && <div className="text-sm text-zinc-300">Carregando...</div>}

        {q.isError && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
            Erro ao carregar rota. {String((q.error as any)?.message ?? "")}
          </div>
        )}

        {data && (
          <>
            {/* Resumo */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold">{data.routeNumber}</div>

                <div className="flex items-center gap-2">
                  <Badge className={routeStatusBadgeClass(data.status)}>{data.status}</Badge>

                  <Badge className="bg-transparent border border-zinc-700 text-zinc-100">
                    {data.totalStops} parada(s)
                  </Badge>
                </div>
              </div>

              <div className="text-xs text-zinc-400">
                Criada: {fmtDate(data.createdAtUtc)} • Início: {fmtDate(data.startedAtUtc)} • Fim:{" "}
                {fmtDate(data.completedAtUtc)}
              </div>

              <div className="text-xs text-zinc-400">
                Entregador: {data.delivererName ?? "—"}
                {data.delivererVehicle ? ` • ${data.delivererVehicle}` : ""}
                {data.delivererPhone ? ` • ${data.delivererPhone}` : ""}
              </div>

              <div className="pt-2">
                <Button
                  className="rounded-xl font-extrabold"
                  disabled={!canStartRoute(data.status) || startMut.isPending}
                  onClick={() => startMut.mutate()}
                >
                  {startMut.isPending ? "Iniciando..." : "Iniciar rota"}
                </Button>
              </div>
            </div>

            {/* Navegação - Waze & Google Maps */}
            <NavigationButtons routeId={id} routeStatus={data.status} />

            {/* Stops */}
            <div className="space-y-3">
              {data.stops.map((s) => {
                const canDeliver = canDeliverStop(data.status, s.status);
                const canFail = canFailStop(data.status, s.status);

                return (
                  <div
                    key={s.stopId}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold">
                          #{s.sequence} • {s.orderNumber}
                        </div>

                        <div className="text-xs text-zinc-400">
                          {s.customerName} • {s.customerPhone}
                        </div>

                        <div className="text-xs text-zinc-300 mt-1">{s.address}</div>

                        <div className="text-xs text-zinc-500 mt-1">
                          Entregue em: {fmtDate(s.deliveredAtUtc)}
                        </div>
                      </div>

                      {/* ✅ agora o status da parada também tem cor */}
                      <Badge className={stopStatusBadgeClass(s.status)}>{s.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        className="rounded-xl font-extrabold"
                        disabled={!canDeliver || deliveredMut.isPending}
                        onClick={() => deliveredMut.mutate({ stopId: s.stopId })}
                      >
                        {deliveredMut.isPending ? "Salvando..." : "Marcar como entregue"}
                      </Button>

                      <div className="flex gap-2">
                        <input
                          className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                          placeholder="Motivo da falha (ex: cliente ausente)"
                          value={failReason[s.stopId] ?? ""}
                          onChange={(e) =>
                            setFailReason((prev) => ({ ...prev, [s.stopId]: e.target.value }))
                          }
                          disabled={!canFail || failMut.isPending}
                        />

                        <Button
                          variant="outline"
                          className="rounded-xl font-extrabold whitespace-nowrap"
                          disabled={
                            !canFail ||
                            failMut.isPending ||
                            !(failReason[s.stopId] ?? "").trim()
                          }
                          onClick={() =>
                            failMut.mutate({
                              stopId: s.stopId,
                              reason: (failReason[s.stopId] ?? "").trim(),
                            })
                          }
                        >
                          Falhou
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
