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
      className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm hover:shadow-lg transition-shadow group h-full min-w-0 flex flex-col cursor-pointer"
      style={{ background: "var(--surface)" }}
      onClick={handleCardClick}
    >
      {/* Imagem */}
      <div className="relative aspect-[4/3] w-full overflow-hidden shrink-0" style={{ background: "var(--surface-2)" }}>
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
        <p className="text-sm font-semibold line-clamp-2 min-h-[40px] leading-tight" style={{ color: "var(--text)" }}>
          {p.name}
        </p>

        {/* Seletor de tamanho — apenas quando há múltiplas variantes */}
        {hasVariants && (
          <div className="mt-2 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-medium transition-colors"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              <span>{selectedVariant?.variantValue ?? "Escolha o tamanho"}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform opacity-50 ${pickerOpen ? "rotate-180" : ""}`} />
            </button>

            {pickerOpen && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl border border-[var(--border)] shadow-lg overflow-hidden" style={{ background: "var(--surface)" }}>
                {p.variants!.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setSelectedVariant(v); setPickerOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-2)]"
                    style={selectedVariant?.id === v.id
                      ? { color: "var(--brand)", fontWeight: 700 }
                      : { color: "var(--text)" }}
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
              <span className="text-[11px] line-through tabular-nums leading-tight opacity-50" style={{ color: "var(--text-muted)" }}>
                {formatBRL(originalCents)}
              </span>
            )}
            <span className="text-sm font-black tabular-nums" style={{ color: "var(--brand)" }}>
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
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: "var(--surface-2)" }}
                aria-label={qty === 1 ? "Remover" : "Diminuir"}
              >
                {qty === 1 ? (
                  <Trash2 className="w-3 h-3 text-red-400" />
                ) : (
                  <Minus className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                )}
              </button>

              <span className="w-5 text-center text-sm font-black tabular-nums select-none" style={{ color: "var(--text)" }}>
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
