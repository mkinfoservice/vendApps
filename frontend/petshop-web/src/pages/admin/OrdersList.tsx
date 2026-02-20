import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrders } from "@/features/admin/orders/queries";
import { type OrderStatus } from "@/features/admin/orders/status";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { AdminNav } from "@/components/admin/AdminNav";
import { Plus } from "lucide-react";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

export default function OrdersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">((searchParams.get("status") as OrderStatus) || "");
  const [search, setSearch] = useState("");

  const ordersQuery = useOrders(page, 20, status || undefined, search || undefined);

  const totalPages = useMemo(() => {
    if (!ordersQuery.data) return 1;
    return Math.max(1, Math.ceil(ordersQuery.data.total / ordersQuery.data.pageSize));
  }, [ordersQuery.data]);

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Pedidos
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {ordersQuery.isLoading ? "Carregando..." : `${total} pedido(s) encontrado(s)`}
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/routes/planner")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          >
            <Plus size={16} />
            Criar rota
          </button>
        </div>

        {/* Filters */}
        <div
          className="rounded-2xl border p-4 mb-4 flex flex-col sm:flex-row gap-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <input
            className="h-10 flex-1 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            placeholder="Buscar por número do pedido..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value as OrderStatus | ""); }}
          >
            <option value="">Todos os status</option>
            <option value="RECEBIDO">Recebido</option>
            <option value="EM_PREPARO">Em preparo</option>
            <option value="PRONTO_PARA_ENTREGA">Pronto para entrega</option>
            <option value="SAIU_PARA_ENTREGA">Saiu para entrega</option>
            <option value="ENTREGUE">Entregue</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        {/* Error */}
        {ordersQuery.isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-4">
            Erro ao carregar pedidos. Tente recarregar a página.
          </div>
        )}

        {/* Table */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Valor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Carregando pedidos...
                  </td>
                </tr>
              )}
              {!ordersQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
              {items.map((o, i) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/admin/orders/${o.orderNumber}`)}
                  className="cursor-pointer transition-colors group"
                  style={{
                    backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(124,92,248,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")}
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{o.orderNumber}</span>
                    <div className="sm:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{o.customerName}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: "var(--text)" }}>{o.customerName}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-semibold" style={{ color: "var(--text)" }}>
                    {formatBRL(o.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(o.createdAtUtc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <button
            className="h-9 px-4 rounded-xl border text-sm font-medium transition-all disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          <button
            className="h-9 px-4 rounded-xl border text-sm font-medium transition-all disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
