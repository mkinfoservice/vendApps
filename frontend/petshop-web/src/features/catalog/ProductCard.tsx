import { Minus, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/features/cart/cart";
import { useToast } from "@/components/Toast";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  discountPercent?: number | null;
  category?: { name: string } | null;
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductCard({ p, onCardClick }: { p: Product; onCardClick?: () => void }) {
  const navigate = useNavigate();
  const cart = useCart();
  const { showToast } = useToast();
  const item = cart.items.find((x) => x.product.id === p.id);
  const qty = item?.qty ?? 0;
  const img = p.imageUrl || "https://picsum.photos/seed/pet/400/400";
  const hasDiscount = p.discountPercent != null && p.discountPercent > 0;
  const originalCents = hasDiscount
    ? Math.round(p.priceCents / (1 - p.discountPercent! / 100))
    : null;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    cart.add(p as any);
    showToast(`${p.name} adicionado ao carrinho!`);
  }

  function handleDec(e: React.MouseEvent) {
    e.stopPropagation();
    qty === 1 ? cart.remove(p.id) : cart.dec(p.id);
  }

  function handleInc(e: React.MouseEvent) {
    e.stopPropagation();
    cart.inc(p.id);
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow group h-full min-w-0 flex flex-col cursor-pointer"
      onClick={() => (onCardClick ? onCardClick() : navigate(`/produto/${p.id}`))}
    >
      {/* Imagem — aspect-ratio fixo para consistência em qualquer largura */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 shrink-0">
        <img
          src={img}
          alt={p.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Badge de desconto */}
        {hasDiscount && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black text-white bg-red-500 shadow-sm leading-none">
              PROMOÇÃO
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black text-white bg-emerald-500 shadow-sm leading-none">
              -{p.discountPercent}%
            </span>
          </div>
        )}

        {qty > 0 && (
          <div className="absolute top-2 right-2">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-black shadow-md"
              style={{ background: "var(--brand)" }}
            >
              {qty}
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo — flex-1 + mt-auto alinha botão na base em todos os cards */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px] leading-tight">
          {p.name}
        </p>

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="flex flex-col">
            {originalCents && (
              <span className="text-[11px] text-gray-400 line-through tabular-nums leading-tight">
                {formatBRL(originalCents)}
              </span>
            )}
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
              {formatBRL(p.priceCents)}
            </span>
          </div>

          {qty === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shrink-0 shadow-sm"
              style={{ background: "var(--brand)" }}
              aria-label="Adicionar ao carrinho"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleDec}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                aria-label={qty === 1 ? "Remover" : "Diminuir"}
              >
                {qty === 1 ? (
                  <Trash2 className="w-3 h-3 text-red-400" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-600" />
                )}
              </button>

              <span className="w-5 text-center text-sm font-bold text-gray-900 tabular-nums select-none">
                {qty}
              </span>

              <button
                type="button"
                onClick={handleInc}
                className="w-7 h-7 rounded-full text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-sm"
                style={{ background: "var(--brand)" }}
                aria-label="Aumentar"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
