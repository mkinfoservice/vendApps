import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { fetchRoutes } from "@/features/admin/routes/api";
import { ROUTE_STATUS_LABEL } from "@/features/admin/routes/status";
import type { RouteStatus } from "@/features/admin/routes/types";
import { Plus, Eye, Route } from "lucide-react";

const STATUS_STYLE: Record<RouteStatus, { badge: string; dot: string }> = {
  Criada:      { badge: "bg-zinc-700/40 text-zinc-300",       dot: "#94a3b8" },
  Atribuida:   { badge: "bg-blue-500/20 text-blue-400",       dot: "#3b82f6" },
  EmAndamento: { badge: "bg-amber-500/20 text-amber-400",     dot: "#f59e0b" },
  Concluida:   { badge: "bg-emerald-500/20 text-emerald-400", dot: "#10b981" },
  Cancelada:   { badge: "bg-red-500/20 text-red-400",         dot: "#ef4444" },
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function RoutesList() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get("status") ?? "");

  const key = useMemo(() => ["routes", page, status], [page, status]);

  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchRoutes(page, 20, status || undefined),
  });

  const routes = q.data?.items ?? [];
  const total  = q.data?.total ?? 0;
  const totalPages = q.data
    ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize))
    : 1;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        <PageHeader
          title="Rotas"
          subtitle={
            q.isLoading
              ? "Carregando..."
              : `${total} rota${total !== 1 ? "s" : ""} encontrada${total !== 1 ? "s" : ""}`
          }
          actions={
            <button
              type="button"
              onClick={() => nav("/app/logistica/rotas/planner")}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
            >
              <Plus size={15} />
              Nova rota
            </button>
          }
        />

        {/* Filters */}
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          >
            <option value="">Todos os status</option>
            <option value="Criada">Criada</option>
            <option value="Atribuida">Atribuída</option>
            <option value="EmAndamento">Em Andamento</option>
            <option value="Concluida">Concluída</option>
            <option value="Cancelada">Cancelada</option>
          </select>
        </div>

        {/* Error */}
        {q.isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-4">
            Erro ao carregar rotas. Tente recarregar a página.
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Rota</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Entregador</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Paradas</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Criada em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <TableSkeleton rows={6} cols={6} />}

              {!q.isLoading && routes.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Route}
                      title="Nenhuma rota encontrada"
                      description={
                        status
                          ? "Tente outro filtro de status."
                          : "Crie uma nova rota de entrega pelo planejador."
                      }
                      action={
                        !status ? (
                          <button
                            type="button"
                            onClick={() => nav("/app/logistica/rotas/planner")}
                            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white"
                            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                          >
                            <Plus size={15} />
                            Nova rota
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}

              {routes.map((r, i) => {
                const cfg = STATUS_STYLE[r.status as RouteStatus] ?? STATUS_STYLE.Criada;
                return (
                  <tr
                    key={r.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-semibold" style={{ color: "var(--text)" }}>
                        {r.routeNumber}
                      </span>
                      <div className="sm:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {r.delivererName ?? "Sem entregador"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell" style={{ color: "var(--text)" }}>
                      {r.delivererName ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.dot }}
                        />
                        {ROUTE_STATUS_LABEL[r.status as RouteStatus] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                      >
                        {r.totalStops}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3.5 text-right hidden lg:table-cell text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {fmtDate(r.createdAtUtc)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => nav(`/app/logistica/rotas/${r.id}`)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
                      >
                        <Eye size={13} />
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}
