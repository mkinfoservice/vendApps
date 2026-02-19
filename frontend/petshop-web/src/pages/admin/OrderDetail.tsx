import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrderById, useUpdateOrderStatus } from "@/features/admin/orders/queries";
import { OrderItemsList } from "@/features/admin/orders/components/OrderItemsList";
import { OrderStatusSelect } from "@/features/admin/orders/components/OrderStatusSelect";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { type OrderStatus } from "@/features/admin/orders/status";
import { paymentLabel } from "@/features/admin/orders/payment";
import { AdminNav } from "@/components/admin/AdminNav";




function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

export default function OrderDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const idOrNumber = params.id ?? "";

  const orderQuery = useOrderById(idOrNumber);
  const updateStatus = useUpdateOrderStatus();

  const order = orderQuery.data;

  const status = (order?.status ?? "RECEBIDO") as OrderStatus;

  const isUpdating = updateStatus.isPending;

  const canEdit = useMemo(() => {
    return !!order;
  }, [order]);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50"><AdminNav />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-extrabold">Pedido</div>
            <div className="text-sm text-zinc-300">
              {order ? order.orderNumber : "Carregando..."}
            </div>
          </div>
          <button
            className="rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
            onClick={() => navigate("/admin/orders")}
          >
            Voltar
          </button>
        </div>

        {orderQuery.isLoading && <div className="text-sm text-zinc-400">Carregando pedido...</div>}

        {!orderQuery.isLoading && !order && (
          <div className="text-sm text-zinc-400">Pedido não encontrado.</div>
        )}

        {order && (
          <>
            {/* Status */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
              <div className="text-sm font-extrabold">Status</div>
              <div className="text-xs text-zinc-400">
                Atual: <OrderStatusBadge status={status} />
              </div>

                <OrderStatusSelect
                value={status}
                disabled={!canEdit || isUpdating}
                onChange={(next) => {
                    if (next === status) return;
                    updateStatus.mutate({ idOrNumber, status: next });
                }}
                />

                {isUpdating && <div className="text-xs text-zinc-400">Atualizando status...</div>}

                {updateStatus.isError && (
                 <div className="text-xs text-red-300">
                 Erro ao atualizar status. Tente novamente.
                </div>
                )}


            </div>

            {/* Cliente */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
              <div className="text-sm font-extrabold">Cliente</div>
              <div className="text-sm text-zinc-200">{order.name}</div>
              <div className="text-sm text-zinc-400">{order.phone}</div>
            </div>

            {/* Endereço */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
              <div className="text-sm font-extrabold">Entrega</div>
              <div className="text-sm text-zinc-200">{order.address}</div>
              <div className="text-xs text-zinc-400">CEP: {order.cep}</div>
            </div>

            {/* Itens */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <div className="text-sm font-extrabold">Itens</div>
              <OrderItemsList items={order.items} />
            </div>

            {/* Totais */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
              <div className="text-sm font-extrabold">Resumo</div>
              <div className="flex justify-between text-sm text-zinc-300">
                <span>Subtotal</span>
                <span className="font-bold text-zinc-50">{formatBRL(order.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-300">
                <span>Entrega</span>
                <span className="font-bold text-zinc-50">{formatBRL(order.deliveryCents)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold">{formatBRL(order.totalCents)}</span>
              </div>
            </div>

            {/* Pagamento */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
              <div className="text-sm font-extrabold">Pagamento</div>
              <div className="text-sm text-zinc-200">{paymentLabel(order.paymentMethodStr)}</div>

              {order.paymentMethodStr === "CASH" && (
                <div className="text-xs text-zinc-300 space-y-1">
                  <div>Troco para: {formatBRL(order.cashGivenCents ?? 0)}</div>
                  <div>Troco: {formatBRL(order.changeCents ?? 0)}</div>
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2 text-xs text-zinc-400">
              <div>Pedido criado em: {formatDate(order.createdAtUtc)}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
