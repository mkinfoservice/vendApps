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
    return (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

export function OrderItemsList({ items }: Props) {
    if (!items.length) {
        return <p className="text-sm text-zinc-400">Nenhum item neste pedido.</p>;
    }

    return (
        <div className="space-y-2">
      {items.map((i) => (
        <div
          key={`${i.productId}-${i.qty}-${i.unitPriceCents}`}
          className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
        >
          <div className="flex-1">
            <div className="text-sm font-bold text-zinc-100">{i.productName}</div>
            <div className="text-xs text-zinc-400">
              {i.qty}x {formatBRL(i.unitPriceCents)}
            </div>
          </div>

          <div className="text-sm font-extrabold text-zinc-50 whitespace-nowrap">
            {formatBRL(i.totalPriceCents)}
          </div>
        </div>
      ))}
    </div>
  );
}