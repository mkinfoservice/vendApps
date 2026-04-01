import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrderById, useUpdateOrderStatus } from "@/features/admin/orders/queries";
import { OrderItemsList } from "@/features/admin/orders/components/OrderItemsList";
import { OrderStatusSelect } from "@/features/admin/orders/components/OrderStatusSelect";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { type OrderStatus } from "@/features/admin/orders/status";
import { paymentLabel } from "@/features/admin/orders/payment";
import { reprintOrder } from "@/features/admin/print/api";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { hasRole } from "@/features/admin/auth/auth";
import { Printer } from "lucide-react";

const ORDERED_STATUSES = [
  "RECEBIDO", "EM_PREPARO", "PRONTO_PARA_ENTREGA",
] as const;

const STATUS_LABELS: Record<string, string> = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  PRONTO_PARA_ENTREGA: "Pronto para servir",
  SAIU_PARA_ENTREGA: "Saiu p/ entrega",
  ENTREGUE: "Entregue",
};

async function retrogradeStatus(idOrNumber: string, status: string) {
  return adminFetch(`/admin/orders/${idOrNumber}/retrograde`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

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
  const [reprinting, setReprinting] = useState(false);
  const [retrograding, setRetrograding] = useState(false);

  const order = orderQuery.data;
  const status = (order?.status ?? "RECEBIDO") as OrderStatus;
  const isUpdating = updateStatus.isPending;
  const canManage = hasRole("admin", "gerente");

  const canEdit = useMemo(() => !!order, [order]);

  async function handleReprint() {
    if (!order) return;
    setReprinting(true);
    try { await reprintOrder(order.id as string); } finally { setReprinting(false); }
  }

  async function handleRetrograde(newStatus: string) {
    if (!order) return;
    setRetrograding(true);
    try {
      await retrogradeStatus(idOrNumber, newStatus);
      orderQuery.refetch();
    } finally {
      setRetrograding(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-extrabold">Pedido</div>
            <div className="text-sm text-[var(--text-muted)]">
              {order ? order.orderNumber : "Carregando..."}
            </div>
          </div>
          <div className="flex gap-2">
            {order && (
              <button
                onClick={handleReprint}
                disabled={reprinting}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface)] transition flex items-center gap-1.5 disabled:opacity-50"
                title="Reimprimir pedido"
              >
                <Printer size={14} />
                {reprinting ? "..." : "Imprimir"}
              </button>
            )}
            <button
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface)] transition"
              onClick={() => navigate("/app/pedidos")}
            >
              Voltar
            </button>
          </div>
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
                isTableOrder={order.isTableOrder}
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

              {/* Retrocesso — admin/gerente apenas */}
              {canManage && status !== "CANCELADO" && (
                <div className="border-t border-[var(--border)] pt-3 mt-2">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                    Retroceder status (gerente)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ORDERED_STATUSES
                      .filter(s => s !== status && ORDERED_STATUSES.indexOf(s) < ORDERED_STATUSES.indexOf(status as typeof ORDERED_STATUSES[number]))
                      .map(s => (
                        <button
                          key={s}
                          onClick={() => handleRetrograde(s)}
                          disabled={retrograding}
                          className="px-2.5 py-1 rounded-lg border text-xs hover:bg-[var(--surface-2)] transition disabled:opacity-50"
                          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                        >
                          ↩ {STATUS_LABELS[s] ?? s}
                        </button>
                      ))}
                  </div>
                  {retrograding && <div className="text-xs text-[var(--text-muted)] mt-1">Atualizando...</div>}
                </div>
              )}
            </div>

            {/* Cliente */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-1">
              <div className="text-sm font-extrabold mb-2">Cliente</div>
              <div className="text-sm text-[var(--text)]">{order.name}</div>
              <div className="text-sm text-[var(--text-muted)]">{order.phone}</div>
            </div>

            {/* Endereço / Mesa */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-1">
              <div className="text-sm font-extrabold mb-2">{order.isTableOrder ? "Mesa" : "Entrega"}</div>
              {order.isTableOrder ? (
                <>
                  <div className="text-sm text-[var(--text)]">
                    Mesa {order.tableNumber ?? "-"}{order.tableName ? ` - ${order.tableName}` : ""}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Pedido de auto-atendimento via QR</div>
                </>
              ) : (
                <>
                  <div className="text-sm text-[var(--text)]">{order.address}</div>
                  <div className="text-xs text-[var(--text-muted)]">CEP: {order.cep}</div>
                </>
              )}
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
                <span>{order.isTableOrder ? "Serviço de mesa" : "Entrega"}</span>
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
