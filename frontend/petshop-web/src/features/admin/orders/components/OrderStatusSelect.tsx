import type { OrderStatus } from "../status";
import { ORDER_STATUS_LABEL, canTransition } from "../status";

type Props = {
  value: OrderStatus;
  onChange: (next: OrderStatus) => void;
  disabled?: boolean;
};

const ALL_STATUSES: OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "PRONTO_PARA_ENTREGA",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
];

export function OrderStatusSelect({ value, onChange, disabled = false }: Props) {
  return (
    <select
      className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
    >
      {ALL_STATUSES.map((s) => {
        const isCurrent = s === value;

        if (value === "CANCELADO" && !isCurrent) return null;

        if (s === "CANCELADO") {
          return (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          );
        }

        const isAllowed = canTransition(value, s) || isCurrent;

        return (
          <option key={s} value={s} disabled={!isAllowed}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        );
      })}
    </select>
  );
}
