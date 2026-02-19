import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "@/features/admin/orders/queries";
import { type OrderStatus } from "@/features/admin/orders/status";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/button";


function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

export default function OrdersList() {
  const navigate = useNavigate();
  const nav = useNavigate();

  // filtros
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");

  const ordersQuery = useOrders(page, 20, status || undefined, search || undefined);

  const totalPages = useMemo(() => {
    if (!ordersQuery.data) return 1;
    return Math.max(1, Math.ceil(ordersQuery.data.total / ordersQuery.data.pageSize));
  }, [ordersQuery.data]);

  const items = ordersQuery.data?.items ?? [];

  return (
    
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
  <AdminNav />
  <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 space-y-4">
    
    {/* Header */}
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-lg font-extrabold">Pedidos</div>
        <div className="text-sm text-zinc-300">Painel administrativo</div>
      </div>
      <Button onClick={() => nav("/admin/routes/planner")}>
        Criar rota
      </Button>
    </div>

        {/* Filtros */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="text-sm font-extrabold">Filtros</div>

          <input
            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="Buscar por número do pedido"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />

          <select
            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as OrderStatus | "");
            }}
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

        {/* Lista */}
        <div className="space-y-3">
          {ordersQuery.isLoading && (
            <div className="text-sm text-zinc-400">Carregando pedidos...</div>
          )}

          {!ordersQuery.isLoading && items.length === 0 && (
            <div className="text-sm text-zinc-400">Nenhum pedido encontrado.</div>
          )}

          {items.map((o) => (
            <button
              key={o.id}
              className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 hover:bg-zinc-900"
              onClick={() => navigate(`/admin/orders/${o.orderNumber}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold">{o.orderNumber}</div>
                <div className="text-xs text-zinc-300">{formatDate(o.createdAtUtc)}</div>
              </div>

              <div className="mt-1 text-sm text-zinc-200">{o.customerName}</div>

              <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                <OrderStatusBadge status={o.status as OrderStatus} />
                <span className="font-bold text-zinc-50">{formatBRL(o.totalCents)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Paginação simples */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <button
            className="rounded-xl border border-zinc-800 px-3 py-2 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>

          <span>
            Página {page} de {totalPages}
          </span>

          <button
            className="rounded-xl border border-zinc-800 px-3 py-2 disabled:opacity-50"
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
