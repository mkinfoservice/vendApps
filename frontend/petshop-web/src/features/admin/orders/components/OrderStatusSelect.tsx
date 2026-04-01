import type { OrderStatus } from "../status";
import { ORDER_STATUS_LABEL } from "../status";

type Props = {
  value: OrderStatus;
  onChange: (next: OrderStatus) => void;
  disabled?: boolean;
  isDeliveryOrder?: boolean;
};

const DELIVERY_STATUSES: OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "PRONTO_PARA_ENTREGA",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
];

const SERVICE_STATUSES: OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "PRONTO_PARA_ENTREGA",
  "ENTREGUE",
];

const STATUS_STYLE: Record<OrderStatus, string> = {
  RECEBIDO: "border-sky-300/45 text-sky-700 bg-sky-50",
  EM_PREPARO: "border-amber-300/50 text-amber-700 bg-amber-50",
  PRONTO_PARA_ENTREGA: "border-emerald-300/50 text-emerald-700 bg-emerald-50",
  SAIU_PARA_ENTREGA: "border-violet-300/50 text-violet-700 bg-violet-50",
  ENTREGUE: "border-emerald-500/45 text-emerald-800 bg-emerald-100",
  CANCELADO: "border-red-300/50 text-red-700 bg-red-50",
};

function isTransitionAllowed(current: OrderStatus, next: OrderStatus, flow: OrderStatus[]) {
  if (current === "CANCELADO") return false;
  if (next === "CANCELADO") return true;
  if (current === next) return true;

  const fromIndex = flow.indexOf(current);
  const toIndex = flow.indexOf(next);
  if (fromIndex < 0 || toIndex < 0) return false;
  return toIndex === fromIndex + 1;
}

function labelFor(status: OrderStatus, isDeliveryOrder: boolean) {
  if (status === "PRONTO_PARA_ENTREGA") {
    return isDeliveryOrder ? "Pronto para entrega" : "Pronto para servir";
  }
  return ORDER_STATUS_LABEL[status];
}

export function OrderStatusSelect({ value, onChange, disabled = false, isDeliveryOrder = false }: Props) {
  const flow = isDeliveryOrder ? DELIVERY_STATUSES : SERVICE_STATUSES;
  const nextStatus = value === "CANCELADO" ? null : flow[flow.indexOf(value) + 1] ?? null;

  if (value === "CANCELADO") {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="text-xs text-[var(--text-muted)]">Status final</div>
        <div className="mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold border-red-300/50 text-red-700 bg-red-50">
          Cancelado
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="flex flex-wrap gap-2">
        {flow.map((status) => {
          const isCurrent = status === value;
          const isAllowed = isTransitionAllowed(value, status, flow);
          const isDisabled = disabled || !isAllowed;

          return (
            <button
              key={status}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(status)}
              className={[
                "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                "disabled:cursor-not-allowed disabled:opacity-45",
                isCurrent
                  ? STATUS_STYLE[status]
                  : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface)]",
              ].join(" ")}
            >
              {labelFor(status, isDeliveryOrder)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
        <div className="text-xs text-[var(--text-muted)]">
          Proximo recomendado:{" "}
          <span className="font-semibold text-[var(--text)]">
            {nextStatus ? labelFor(nextStatus, isDeliveryOrder) : "Finalizado"}
          </span>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("CANCELADO")}
          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Cancelar pedido
        </button>
      </div>
    </div>
  );
}
