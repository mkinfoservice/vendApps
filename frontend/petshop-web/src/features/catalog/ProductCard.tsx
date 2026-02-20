import { Plus, Tag } from "lucide-react";
import { useCart } from "@/features/cart/cart";

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

export function ProductCard({ p }: { p: Product }) {
  const cart = useCart();
  const item = cart.items.find((x) => x.product.id === p.id);
  const img = p.imageUrl || "https://picsum.photos/seed/pet/800/600";

  return (
    <div
      className="rounded-3xl border overflow-hidden shadow-sm"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      {/* Imagem */}
      <div className="relative h-[180px] w-full" style={{ backgroundColor: "var(--surface-2)" }}>
        <img src={img} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

        {/* categoria */}
        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white bg-black/60 border border-white/10">
            <Tag className="h-3.5 w-3.5" />
            {p.category?.name ?? "Categoria"}
          </span>
        </div>

        {/* badge carrinho */}
        {item?.qty ? (
          <div className="absolute right-3 top-3">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: "#7c5cf8" }}
            >
              No carrinho: {item.qty}
            </span>
          </div>
        ) : null}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-[var(--text)] line-clamp-2">{p.name}</div>
          <div className="mt-2 text-lg font-black text-[var(--text)] tabular-nums">
            {formatBRL(p.priceCents)}
          </div>
        </div>

        <button
          type="button"
          className="h-11 px-4 rounded-2xl font-black text-sm text-white flex items-center gap-1.5 shrink-0 transition"
          style={{ backgroundColor: "#7c5cf8" }}
          onClick={() => cart.add(p as any)}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>
    </div>
  );
}
