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

  const canEdit = useMemo(() => !!order, [order]);

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AdminNav />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-extrabold">Pedido</div>
            <div className="text-sm text-[var(--text-muted)]">
              {order ? order.orderNumber : "Carregando..."}
            </div>
          </div>
          <button
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface)] transition"
            onClick={() => navigate("/admin/orders")}
          >
            Voltar
          </button>
        </div>

        {orderQuery.isLoading && (
          <div className="text-sm text-[var(--text-muted)]">Carregando pedido...</div>
        )}

        {!orderQuery.isLoading && !order && (
          <div className="text-sm text-[var(--text-muted)]">Pedido não encontrado.</div>
        )}

        {order && (
          <>
            {/* Status */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
              <div className="text-sm font-extrabold">Status</div>
              <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
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

              {isUpdating && (
                <div className="text-xs text-[var(--text-muted)]">Atualizando status...</div>
              )}

              {updateStatus.isError && (
                <div className="text-xs text-red-400">
                  Erro ao atualizar status. Tente novamente.
                </div>
              )}
            </div>

            {/* Cliente */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-1">
              <div className="text-sm font-extrabold mb-2">Cliente</div>
              <div className="text-sm text-[var(--text)]">{order.name}</div>
              <div className="text-sm text-[var(--text-muted)]">{order.phone}</div>
            </div>

            {/* Endereço */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-1">
              <div className="text-sm font-extrabold mb-2">Entrega</div>
              <div className="text-sm text-[var(--text)]">{order.address}</div>
              <div className="text-xs text-[var(--text-muted)]">CEP: {order.cep}</div>
            </div>

            {/* Itens */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <div className="text-sm font-extrabold">Itens</div>
              <OrderItemsList items={order.items} />
            </div>

            {/* Totais */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
              <div className="text-sm font-extrabold mb-1">Resumo</div>
              <div className="flex justify-between text-sm text-[var(--text-muted)]">
                <span>Subtotal</span>
                <span className="font-bold text-[var(--text)]">{formatBRL(order.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm text-[var(--text-muted)]">
                <span>Entrega</span>
                <span className="font-bold text-[var(--text)]">{formatBRL(order.deliveryCents)}</span>
              </div>
              <div className="h-px bg-[var(--border)] my-1" />
              <div className="flex justify-between text-base font-extrabold">
                <span>Total</span>
                <span style={{ color: "#7c5cf8" }}>{formatBRL(order.totalCents)}</span>
              </div>
            </div>

            {/* Pagamento */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
              <div className="text-sm font-extrabold">Pagamento</div>
              <div className="text-sm text-[var(--text)]">{paymentLabel(order.paymentMethodStr)}</div>

              {order.paymentMethodStr === "CASH" && (
                <div className="text-xs text-[var(--text-muted)] space-y-1">
                  <div>Troco para: <span className="text-[var(--text)]">{formatBRL(order.cashGivenCents ?? 0)}</span></div>
                  <div>Troco: <span className="text-[var(--text)]">{formatBRL(order.changeCents ?? 0)}</span></div>
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--text-muted)]">
              Pedido criado em: {formatDate(order.createdAtUtc)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
