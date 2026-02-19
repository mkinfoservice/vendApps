import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminNav } from "@/components/admin/AdminNav";

import { fetchRoutes } from "@/features/admin/routes/api";
import { routeStatusBadgeClass } from "@/features/admin/routes/status";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

export default function RoutesList() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");

  const key = useMemo(() => ["routes", page, status], [page, status]);

  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchRoutes(page, 20, status || undefined),
  });

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Rotas</div>
            <div className="text-sm text-zinc-300">Acompanhe entregas e paradas.</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm text-zinc-300">Filtro status:</div>

            <select
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">Todos</option>
              <option value="Criada">Criada</option>
              <option value="EmAndamento">Em andamento</option>
              <option value="Concluida">Concluída</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>

          <div className="text-xs text-zinc-400">
            {q.isLoading ? "Carregando..." : q.data ? `${q.data.total} rota(s)` : "—"}
          </div>
        </div>

        {/* Erro */}
        {q.isError && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
            Erro ao carregar rotas. {String((q.error as any)?.message ?? "")}
          </div>
        )}

        {/* Lista */}
        <div className="space-y-3">
          {(q.data?.items ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => nav(`/admin/routes/${r.id}`)}
              className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 hover:bg-zinc-900 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-extrabold">{r.routeNumber}</div>

                  <div className="text-xs text-zinc-400">
                    Criada: {fmtDate(r.createdAtUtc)} • Início: {fmtDate(r.startedAtUtc)} • Fim:{" "}
                    {fmtDate(r.completedAtUtc)}
                  </div>

                  <div className="text-xs text-zinc-400 mt-1">
                    Entregador: {r.delivererName ?? "—"}
                    {r.delivererVehicle ? ` • ${r.delivererVehicle}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={routeStatusBadgeClass(r.status)}>{r.status}</Badge>

                  <Badge className="bg-transparent border border-zinc-700 text-zinc-100">
                    {r.totalStops} parada(s)
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between pt-2">
          <Button
            className="rounded-xl"
            variant="outline"
            disabled={page <= 1 || q.isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>

          <div className="text-xs text-zinc-400">Página {page}</div>

          <Button
            className="rounded-xl"
            variant="outline"
            disabled={q.isLoading || (q.data ? page * q.data.pageSize >= q.data.total : true)}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
