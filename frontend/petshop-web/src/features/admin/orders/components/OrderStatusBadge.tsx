import { ORDER_STATUS_LABEL, type OrderStatus } from "../status";

type Props = {
    status: OrderStatus;
};

const STATUS_CLASS: Record<OrderStatus, string> = {
    RECEBIDO: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  EM_PREPARO: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  PRONTO_PARA_ENTREGA: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  SAIU_PARA_ENTREGA: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  ENTREGUE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  CANCELADO: "bg-red-500/15 text-red-300 border-red-500/20",
};

export function OrderStatusBadge({ status }: Props) {
    return (
         <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status]}`}
    >
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}