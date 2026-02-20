import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchRoutes } from "@/features/admin/routes/api";
import { ROUTE_STATUS_LABEL } from "@/features/admin/routes/status";
import type { RouteStatus } from "@/features/admin/routes/types";
import { Plus, Eye } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────

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
  const total = q.data?.total ?? 0;
  const hasMore = q.data ? page * q.data.pageSize < q.data.total : false;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Rotas</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {q.isLoading ? "Carregando..." : `${total} rota(s) encontrada(s)`}
            </p>
          </div>
          <button
            onClick={() => nav("/admin/routes/planner")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          >
            <Plus size={16} />
            Nova rota
          </button>
        </div>

        {/* Filters */}
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
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
            Erro ao carregar rotas.
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
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
              {q.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Carregando rotas...
                  </td>
                </tr>
              )}
              {!q.isLoading && routes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Nenhuma rota encontrada.
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
                    <td className="px-4 py-3">
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{r.routeNumber}</span>
                      <div className="sm:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {r.delivererName ?? "Sem entregador"}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: "var(--text)" }}>
                      {r.delivererName ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                        {ROUTE_STATUS_LABEL[r.status as RouteStatus] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                      >
                        {r.totalStops}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                      {fmtDate(r.createdAtUtc)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => nav(`/admin/routes/${r.id}`)}
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

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <button
            className="h-9 px-4 rounded-xl border text-sm font-medium disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            disabled={page <= 1 || q.isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Página {page}</span>
          <button
            className="h-9 px-4 rounded-xl border text-sm font-medium disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            disabled={q.isLoading || !hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
