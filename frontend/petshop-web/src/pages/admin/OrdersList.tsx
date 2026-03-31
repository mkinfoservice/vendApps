import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDeleteAllDeliveries, useDeleteFinalizedDeliveries, useOrders } from "@/features/admin/orders/queries";
import { type OrderStatus } from "@/features/admin/orders/status";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Plus, ShoppingBag, Search, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

const STATUS_OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "RECEBIDO", label: "Recebido" },
  { value: "EM_PREPARO", label: "Em preparo" },
  { value: "PRONTO_PARA_ENTREGA", label: "Pronto para entrega" },
  { value: "SAIU_PARA_ENTREGA", label: "Saiu para entrega" },
  { value: "ENTREGUE", label: "Entregue" },
  { value: "CANCELADO", label: "Cancelado" },
];

export default function OrdersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useCurrentUser();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">(
    (searchParams.get("status") as OrderStatus) || "",
  );
  const [search, setSearch] = useState("");

  const ordersQuery = useOrders(page, 20, status || undefined, search || undefined);
  const deleteAllDeliveriesMut = useDeleteAllDeliveries();
  const deleteFinalizedDeliveriesMut = useDeleteFinalizedDeliveries();

  const totalPages = useMemo(() => {
    if (!ordersQuery.data) return 1;
    return Math.max(1, Math.ceil(ordersQuery.data.total / ordersQuery.data.pageSize));
  }, [ordersQuery.data]);

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        <PageHeader
          title="Pedidos"
          subtitle={
            ordersQuery.isLoading
              ? "Carregando..."
              : `${total} pedido${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`
          }
          actions={
            <div className="flex items-center gap-2">
              {role === "admin" && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Apagar entregas encerradas (ENTREGUE e CANCELADO)? Esta acao nao pode ser desfeita.")) return;
                      try {
                        const res = await deleteFinalizedDeliveriesMut.mutateAsync();
                        alert(
                          `Limpeza de entregas encerradas concluida.
Pedidos apagados: ${res.deletedOrders}
Paradas apagadas: ${res.deletedRouteStops}
Rotas ?rf?s apagadas: ${res.deletedRoutes}
DAVs de entrega apagados: ${res.deletedDeliveryDavs}`,
                        );
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Erro ao apagar entregas encerradas.");
                      }
                    }}
                    disabled={deleteFinalizedDeliveriesMut.isPending}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)" }}
                  >
                    <Trash2 size={15} />
                    {deleteFinalizedDeliveriesMut.isPending ? "Apagando..." : "Apagar encerradas"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Apagar TODOS os registros de entregas/pedidos desta empresa? Esta a??o n?o pode ser desfeita.")) return;
                      try {
                        const res = await deleteAllDeliveriesMut.mutateAsync();
                        alert(
                          `Limpeza total conclu?da.
Pedidos apagados: ${res.deletedOrders}
Paradas apagadas: ${res.deletedRouteStops}
Rotas ?rf?s apagadas: ${res.deletedRoutes}
DAVs de entrega apagados: ${res.deletedDeliveryDavs}`,
                        );
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Erro ao apagar registros de entregas.");
                      }
                    }}
                    disabled={deleteAllDeliveriesMut.isPending}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #b42318 0%, #ef4444 100%)" }}
                  >
                    <Trash2 size={15} />
                    {deleteAllDeliveriesMut.isPending ? "Apagando..." : "Apagar tudo"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => navigate("/app/logistica/rotas/planner")}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)",
                }}
              >
                <Plus size={15} />
                Criar rota
              </button>
            </div>
          }
        />

        {/* Filters */}
        <div
          className="rounded-2xl border p-4 mb-4 flex flex-col sm:flex-row gap-3"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              className="h-10 w-full rounded-xl border pl-9 pr-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              placeholder="Buscar por número do pedido..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as OrderStatus | "");
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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
          className="rounded-2xl border overflow-hidden mb-4"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Pedido
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cliente
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Status
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  Valor
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading && <TableSkeleton rows={8} cols={5} />}

              {!ordersQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={ShoppingBag}
                      title="Nenhum pedido encontrado"
                      description={
                        search || status
                          ? "Tente ajustar os filtros de busca."
                          : "Os pedidos do catálogo aparecerão aqui."
                      }
                    />
                  </td>
                </tr>
              )}

              {items.map((o, i) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/app/pedidos/${o.orderNumber}`)}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor:
                      i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      "rgba(124,92,248,0.06)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")
                  }
                >
                  <td className="px-4 py-3.5">
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {o.orderNumber}
                    </span>
                    {o.isTableOrder && (
                      <div className="text-xs mt-0.5 font-semibold" style={{ color: "#7c5cf8" }}>
                        Mesa {o.tableNumber ?? "-"}{o.tableName ? ` - ${o.tableName}` : ""}
                      </div>
                    )}
                    <div
                      className="sm:hidden text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {o.customerName}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3.5 hidden sm:table-cell"
                    style={{ color: "var(--text)" }}
                  >
                    {o.customerName}
                  </td>
                  <td className="px-4 py-3.5">
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </td>
                  <td
                    className="px-4 py-3.5 text-right hidden md:table-cell font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {formatBRL(o.totalCents)}
                  </td>
                  <td
                    className="px-4 py-3.5 text-right hidden lg:table-cell text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDate(o.createdAtUtc)}
                  </td>
                </tr>
              ))}
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
