type OrderItem = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  qty: number;
  totalPriceCents: number;
};

type Props = {
  items: OrderItem[];
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrderItemsList({ items }: Props) {
  if (!items.length) {
    return <p className="text-sm text-[var(--text-muted)]">Nenhum item neste pedido.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div
          key={`${i.productId}-${i.qty}-${i.unitPriceCents}`}
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
        >
          <div className="flex-1">
            <div className="text-sm font-bold text-[var(--text)]">{i.productName}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {i.qty}x {formatBRL(i.unitPriceCents)}
            </div>
          </div>

          <div className="text-sm font-extrabold text-[var(--text)] whitespace-nowrap">
            {formatBRL(i.totalPriceCents)}
          </div>
        </div>
      ))}
    </div>
  );
}
