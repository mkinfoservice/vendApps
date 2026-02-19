import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // fallback seguro
  const img = p.imageUrl || "https://picsum.photos/seed/pet/800/600";

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 overflow-hidden shadow-sm">
      {/* Imagem (altura fixa) */}
      <div className="relative h-[180px] w-full bg-zinc-900">
        <img
          src={img}
          alt={p.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* overlay suave para legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

        {/* categoria */}
        <div className="absolute left-3 top-3">
          <Badge className="bg-black/60 text-white border-0">
            <Tag className="h-3.5 w-3.5 mr-1" />
            {p.category?.name ?? "Categoria"}
          </Badge>
        </div>

        {/* badge carrinho */}
        {item?.qty ? (
          <div className="absolute right-3 top-3">
            <Badge className="bg-white text-black border-0">No carrinho: {item.qty}</Badge>
          </div>
        ) : null}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-zinc-50 line-clamp-2">{p.name}</div>
          <div className="mt-2 text-lg font-black text-zinc-50 tabular-nums">
            {formatBRL(p.priceCents)}
          </div>
        </div>

        <Button
          type="button"
          className="rounded-2xl h-11 px-4 font-black shrink-0"
          onClick={() => cart.add(p as any)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}
