import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Printer, Store, Truck, Undo2, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useOrderById, useUpdateOrderStatus } from "@/features/admin/orders/queries";
import { type OrderStatus } from "@/features/admin/orders/status";
import { paymentLabel } from "@/features/admin/orders/payment";
import { reprintOrder } from "@/features/admin/print/api";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { hasRole } from "@/features/admin/auth/auth";
import { fetchTenantInfo, resolveTenantFromHost } from "@/utils/tenant";

const STATUS_FLOW_DELIVERY: OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "PRONTO_PARA_ENTREGA",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
];

const STATUS_FLOW_LOCAL: OrderStatus[] = ["RECEBIDO", "EM_PREPARO", "PRONTO_PARA_ENTREGA", "ENTREGUE"];

const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  PRONTO_PARA_ENTREGA: "Pronto para servir",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

async function retrogradeStatus(idOrNumber: string, status: string) {
  return adminFetch(`/admin/orders/${idOrNumber}/retrograde`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

function normalizeDavCode(code: string) {
  const normalized = code.trim().toUpperCase();
  return normalized.startsWith("DAV-") ? normalized : `DAV-${normalized}`;
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function isTransitionAllowed(current: OrderStatus, next: OrderStatus, flow: OrderStatus[]) {
  if (current === "CANCELADO") return false;
  if (next === "CANCELADO") return true;
  if (current === next) return true;

  const fromIndex = flow.indexOf(current);
  const toIndex = flow.indexOf(next);
  if (fromIndex < 0 || toIndex < 0) return false;
  return toIndex === fromIndex + 1;
}

function statusLabel(status: OrderStatus, isDeliveryOrder: boolean) {
  if (status === "PRONTO_PARA_ENTREGA") return isDeliveryOrder ? "Pronto para entrega" : "Pronto para servir";
  return STATUS_LABEL[status];
}

function statusTone(status: OrderStatus, active: boolean) {
  if (!active) {
    return "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]";
  }
  switch (status) {
    case "RECEBIDO":
      return "border-sky-300/60 bg-sky-50 text-sky-700";
    case "EM_PREPARO":
      return "border-amber-300/70 bg-amber-50 text-amber-800";
    case "PRONTO_PARA_ENTREGA":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-800";
    case "SAIU_PARA_ENTREGA":
      return "border-violet-300/70 bg-violet-50 text-violet-800";
    case "ENTREGUE":
      return "border-emerald-400/70 bg-emerald-100 text-emerald-900";
    case "CANCELADO":
      return "border-red-300/70 bg-red-50 text-red-800";
    default:
      return "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]";
  }
}

export default function OrderDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const idOrNumber = params.id ?? "";

  const tenantSlug = resolveTenantFromHost();
  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenantInfo,
    enabled: !!tenantSlug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const ownDelivery = (tenantQuery.data?.features?.["own_delivery"] ?? true) === true;

  const orderQuery = useOrderById(idOrNumber);
  const updateStatus = useUpdateOrderStatus();
  const [reprinting, setReprinting] = useState(false);
  const [retrograding, setRetrograding] = useState(false);

  const order = orderQuery.data;
  const status = (order?.status ?? "RECEBIDO") as OrderStatus;
  const isUpdating = updateStatus.isPending;
  const canManage = hasRole("admin", "gerente");
  const canEdit = !!order;

  const isDeliveryOrder = useMemo(() => {
    if (!ownDelivery) return false;
    if (!order || order.isTableOrder) return false;
    const hasAddress = Boolean(order.address && order.address.trim() && order.address.trim() !== "-");
    return hasAddress || (order.deliveryCents ?? 0) > 0;
  }, [order, ownDelivery]);

  const statusFlow = isDeliveryOrder ? STATUS_FLOW_DELIVERY : STATUS_FLOW_LOCAL;
  const nextStatus = status === "CANCELADO" ? null : statusFlow[statusFlow.indexOf(status) + 1] ?? null;
  const davCode = order?.davPublicId ? normalizeDavCode(order.davPublicId) : null;

  async function handleReprint() {
    if (!order) return;
    setReprinting(true);
    try {
      await reprintOrder(order.id as string);
    } finally {
      setReprinting(false);
    }
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
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 pt-5 md:space-y-5 md:px-6">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <button
                onClick={() => navigate("/app/pedidos")}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-2)]"
              >
                <ArrowLeft size={14} />
                Voltar para pedidos
              </button>
              <div>
                <h1 className="text-2xl font-black tracking-tight md:text-3xl">Pedido</h1>
                <div className="text-sm text-[var(--text-muted)]">{order ? order.orderNumber : "Carregando..."}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {order && (
                <button
                  onClick={handleReprint}
                  disabled={reprinting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
                >
                  <Printer size={14} />
                  {reprinting ? "Imprimindo..." : "Imprimir"}
                </button>
              )}
              {davCode && (
                <button
                  onClick={() => navigate(`/pdv?dav=${encodeURIComponent(davCode)}&autoImport=1`)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700"
                >
                  <Wallet size={14} />
                  Importar no caixa
                </button>
              )}
            </div>
          </div>
        </section>

        {orderQuery.isLoading && <div className="text-sm text-[var(--text-muted)]">Carregando pedido...</div>}

        {!orderQuery.isLoading && !order && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            Pedido não encontrado.
          </div>
        )}

        {order && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
            <div className="space-y-4 xl:col-span-8">
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-black">Status do pedido</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {isDeliveryOrder
                        ? "Fluxo: Recebido -> Em preparo -> Pronto para entrega -> Saiu para entrega -> Entregue"
                        : "Fluxo Go Coffee: Recebido -> Em preparo -> Pronto para servir -> Entregue"}
                    </div>
                  </div>
                  <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                    Atual: <span className="font-black text-[var(--text)]">{statusLabel(status, isDeliveryOrder)}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {statusFlow.map((flowStatus) => {
                    const active = flowStatus === status;
                    const allowed = isTransitionAllowed(status, flowStatus, statusFlow);
                    const disabled = !canEdit || isUpdating || !allowed;

                    return (
                      <button
                        key={flowStatus}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (flowStatus === status) return;
                          updateStatus.mutate({ idOrNumber, status: flowStatus });
                        }}
                        className={[
                          "rounded-xl border px-4 py-2 text-sm font-bold transition",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                          statusTone(flowStatus, active),
                        ].join(" ")}
                      >
                        {statusLabel(flowStatus, isDeliveryOrder)}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[var(--text-muted)]">
                    Próximo recomendado:{" "}
                    <span className="font-black text-[var(--text)]">
                      {nextStatus ? statusLabel(nextStatus, isDeliveryOrder) : "Finalizado"}
                    </span>
                  </div>
                  {status !== "CANCELADO" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => updateStatus.mutate({ idOrNumber, status: "CANCELADO" })}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Ban size={14} />
                      Cancelar pedido
                    </button>
                  )}
                </div>

                {isUpdating && <div className="mt-2 text-xs text-[var(--text-muted)]">Atualizando status...</div>}
                {updateStatus.isError && (
                  <div className="mt-2 text-xs text-red-500">Erro ao atualizar status. Tente novamente.</div>
                )}

                {canManage && status !== "CANCELADO" && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Retroceder status (gerente)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {statusFlow
                        .filter((s) => s !== status && statusFlow.indexOf(s) < statusFlow.indexOf(status))
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => handleRetrograde(s)}
                            disabled={retrograding}
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--surface)] disabled:opacity-50"
                          >
                            <Undo2 size={13} />
                            Voltar para {statusLabel(s, isDeliveryOrder)}
                          </button>
                        ))}
                    </div>
                    {retrograding && <div className="mt-2 text-xs text-[var(--text-muted)]">Atualizando...</div>}
                  </div>
                )}
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Cliente</div>
                  <div className="text-lg font-black">{order.name}</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">{order.phone || "Sem telefone"}</div>
                </div>

                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {order.isTableOrder ? "Mesa" : isDeliveryOrder ? "Entrega" : "Atendimento"}
                  </div>
                  {order.isTableOrder ? (
                    <div className="flex items-start gap-2 text-sm">
                      <Store size={16} className="mt-0.5 text-[var(--text-muted)]" />
                      <div>
                        <div className="font-semibold text-[var(--text)]">
                          Mesa {order.tableNumber ?? "-"}
                          {order.tableName ? ` - ${order.tableName}` : ""}
                        </div>
                        <div className="text-[var(--text-muted)]">Pedido de autoatendimento via QR</div>
                      </div>
                    </div>
                  ) : isDeliveryOrder ? (
                    <div className="flex items-start gap-2 text-sm">
                      <Truck size={16} className="mt-0.5 text-[var(--text-muted)]" />
                      <div>
                        <div className="font-semibold text-[var(--text)]">{order.address || "Sem endereço"}</div>
                        <div className="text-[var(--text-muted)]">CEP: {order.cep || "-"}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--text-muted)]">Consumo local sem dados de entrega.</div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
                <div className="mb-3 text-base font-black">Itens do pedido</div>
                <div className="space-y-2">
                  {order.items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                      Nenhum item neste pedido.
                    </div>
                  )}
                  {order.items.map((item) => (
                    <article
                      key={`${item.productId}-${item.qty}-${item.unitPriceCents}`}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-[var(--text)]">{item.productName}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {item.qty}x {formatBRL(item.unitPriceCents)}
                          </div>
                        </div>
                        <div className="shrink-0 text-base font-black text-[var(--text)]">{formatBRL(item.totalPriceCents)}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-4 xl:col-span-4">
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
                <div className="mb-3 text-base font-black">Resumo</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[var(--text)]">{formatBRL(order.subtotalCents)}</span>
                  </div>
                  {isDeliveryOrder && (
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Entrega</span>
                      <span className="font-semibold text-[var(--text)]">{formatBRL(order.deliveryCents)}</span>
                    </div>
                  )}
                </div>
                <div className="my-3 h-px bg-[var(--border)]" />
                <div className="flex items-center justify-between">
                  <span className="text-base font-black">Total</span>
                  <span className="text-xl font-black text-[var(--accent)]">{formatBRL(order.totalCents)}</span>
                </div>
              </section>

              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
                <div className="mb-2 text-base font-black">Pagamento</div>
                <div className="text-sm font-semibold text-[var(--text)]">{paymentLabel(order.paymentMethodStr)}</div>
                {order.paymentMethodStr === "CASH" && (
                  <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                    <div>
                      Troco para: <span className="font-semibold text-[var(--text)]">{formatBRL(order.cashGivenCents ?? 0)}</span>
                    </div>
                    <div>
                      Troco: <span className="font-semibold text-[var(--text)]">{formatBRL(order.changeCents ?? 0)}</span>
                    </div>
                  </div>
                )}
              </section>

              {davCode && (
                <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 md:p-5">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">DAV para caixa</div>
                  <div className="text-lg font-black text-emerald-800">{davCode}</div>
                  <button
                    onClick={() => navigate(`/pdv?dav=${encodeURIComponent(davCode)}&autoImport=1`)}
                    className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
                  >
                    Importar agora no caixa
                  </button>
                </section>
              )}

              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--text-muted)]">
                Pedido criado em: {formatDate(order.createdAtUtc)}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
