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
      className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
    >
      {ALL_STATUSES.map((s) => {
        const isCurrent = s === value;

        // regra: se já está CANCELADO, não pode mudar
        if (value === "CANCELADO" && !isCurrent) return null;

        // regra: permitir cancelar a qualquer momento
        if (s === "CANCELADO") {
          return (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          );
        }

        // regra: não pular etapas
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
