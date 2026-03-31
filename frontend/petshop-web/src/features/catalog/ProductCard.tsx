import { useState } from "react";
import { Minus, Plus, Trash2, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/features/cart/cart";
import { useToast } from "@/components/Toast";
import type { ProductVariant } from "@/features/catalog/api";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  description?: string | null;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  discountPercent?: number | null;
  category?: { name: string } | null;
  variants?: ProductVariant[];
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Monta o ID composto usado como chave no carrinho quando há variante. */
function compositeId(productId: string, variantId?: string) {
  return variantId ? `${productId}__${variantId}` : productId;
}

export function ProductCard({ p, onCardClick }: { p: Product; onCardClick?: () => void }) {
  const navigate = useNavigate();
  const cart = useCart();
  const { showToast } = useToast();

  const hasVariants = (p.variants?.length ?? 0) > 1;
  const isSingleVariant = (p.variants?.length ?? 0) === 1;
  const singleVariant = isSingleVariant ? p.variants![0] : null;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants ? p.variants![0] : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Preço e ID efetivos (com ou sem variante)
  const activeVariant = hasVariants ? selectedVariant : singleVariant;
  const activePriceCents = activeVariant?.priceCents ?? p.priceCents;
  const activeId = compositeId(p.id, activeVariant?.id);

  const item = cart.items.find((x) => x.product.id === activeId);
  const qty = item?.qty ?? 0;

  const img = p.imageUrl || "https://picsum.photos/seed/pet/400/400";
  const hasDiscount = p.discountPercent != null && p.discountPercent > 0;
  const originalCents = hasDiscount
    ? Math.round(activePriceCents / (1 - p.discountPercent! / 100))
    : null;

  function buildCartProduct() {
    return {
      ...p,
      id: activeId,
      name: activeVariant ? `${p.name} — ${activeVariant.variantValue}` : p.name,
      priceCents: activePriceCents,
    } as any;
  }

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasVariants && !selectedVariant) return;
    cart.add(buildCartProduct());
    showToast(`${p.name}${activeVariant ? ` (${activeVariant.variantValue})` : ""} adicionado!`);
  }

  function handleDec(e: React.MouseEvent) {
    e.stopPropagation();
    qty === 1 ? cart.remove(activeId) : cart.dec(activeId);
  }

  function handleInc(e: React.MouseEvent) {
    e.stopPropagation();
    cart.inc(activeId);
  }

  function handleCardClick() {
    if (pickerOpen) return;
    onCardClick ? onCardClick() : navigate(`/produto/${p.id}`);
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow group h-full min-w-0 flex flex-col cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Imagem */}
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

        {/* Badge de tamanho único */}
        {singleVariant && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white bg-black/50 backdrop-blur-sm leading-none">
              {singleVariant.variantValue}
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

      {/* Conteúdo */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px] leading-tight">
          {p.name}
        </p>

        {/* Seletor de tamanho — apenas quando há múltiplas variantes */}
        {hasVariants && (
          <div className="mt-2 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 hover:border-gray-300 transition-colors"
            >
              <span>{selectedVariant?.variantValue ?? "Escolha o tamanho"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
            </button>

            {pickerOpen && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                {p.variants!.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setSelectedVariant(v); setPickerOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                      selectedVariant?.id === v.id ? "font-semibold" : "font-normal"
                    }`}
                    style={selectedVariant?.id === v.id ? { color: "var(--brand)" } : { color: "#374151" }}
                  >
                    <span>{v.variantValue}</span>
                    <span className="tabular-nums">{formatBRL(v.priceCents ?? p.priceCents)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="flex flex-col">
            {originalCents && (
              <span className="text-[11px] text-gray-400 line-through tabular-nums leading-tight">
                {formatBRL(originalCents)}
              </span>
            )}
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
              {formatBRL(activePriceCents)}
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
