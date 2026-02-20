import { useCart } from "@/features/cart/cart";
import { Minus, Plus, Trash2 } from "lucide-react";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  category?: { name: string } | null;
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductRow({ p }: { p: Product }) {
  const cart = useCart();
  const item = cart.items.find((x) => x.product.id === p.id);
  const qty = item?.qty ?? 0;
  const img = p.imageUrl || "https://picsum.photos/seed/pet/200/200";

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3 transition"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      {/* thumb */}
      <div className="h-16 w-16 overflow-hidden rounded-2xl shrink-0" style={{ backgroundColor: "var(--surface-2)" }}>
        <img src={img} alt={p.name} className="h-full w-full object-cover" />
      </div>

      {/* info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold text-[var(--text)] line-clamp-1">{p.name}</div>
        <div className="text-xs text-[var(--text-muted)]">{p.category?.name ?? "Categoria"}</div>
        <div className="mt-1 text-sm font-black text-[var(--text)] tabular-nums">{formatBRL(p.priceCents)}</div>
      </div>

      {/* action */}
      {qty === 0 ? (
        <button
          type="button"
          className="h-10 px-4 rounded-2xl font-black text-sm text-white flex items-center gap-1.5 transition"
          style={{ backgroundColor: "#7c5cf8" }}
          onClick={() => cart.add(p as any)}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      ) : (
        <div
          className="flex items-center rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
        >
          <button
            type="button"
            className="h-10 w-10 grid place-items-center hover:bg-[var(--surface)] transition"
            onClick={() => (qty === 1 ? cart.remove(p.id) : cart.dec(p.id))}
            title={qty === 1 ? "Remover" : "Diminuir"}
          >
            {qty === 1
              ? <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
              : <Minus className="h-4 w-4 text-[var(--text-muted)]" />}
          </button>

          <div className="h-10 w-10 grid place-items-center text-sm font-black text-[var(--text)] tabular-nums">
            {qty}
          </div>

          <button
            type="button"
            className="h-10 w-10 grid place-items-center hover:bg-[var(--surface)] transition"
            onClick={() => cart.inc(p.id)}
            title="Aumentar"
          >
            <Plus className="h-4 w-4 text-[var(--text-muted)]" />
          </button>
        </div>
      )}
    </div>
  );
}
