import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, X, ShoppingCart, Plus, Minus, Trash2,
  LayoutGrid, Coffee, Snowflake, Sandwich, CupSoda, ShoppingBag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCategories, useProducts, useStoreFront } from "@/features/catalog/queries";
import type { Product } from "@/features/catalog/api";
import { useCart } from "@/features/cart/cart";
import { ToastProvider, useToast } from "@/components/Toast";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hasOptions(p: Product) {
  return (p.variants?.length ?? 0) > 0 || (p.addons?.length ?? 0) > 0 || (p.addonGroups?.length ?? 0) > 0;
}

function qtyForBaseProduct(items: Array<{ product: Product; qty: number }>, baseId: string) {
  return items.reduce((acc, it) => {
    if (it.product.id === baseId || it.product.id.startsWith(`${baseId}__`)) return acc + it.qty;
    return acc;
  }, 0);
}

function inferCategoryIcon(name: string | null): LucideIcon {
  if (!name) return LayoutGrid;
  const n = name.toLocaleLowerCase();
  if (n.includes("quente") || n.includes("cafe") || n.includes("caf") || n.includes("espresso") || n.includes("capuccino")) return Coffee;
  if (n.includes("gelad") || n.includes("ice") || n.includes("frappe") || n.includes("frap") || n.includes("cold")) return Snowflake;
  if (n.includes("salgado") || n.includes("sanduiche") || n.includes("lanche") || n.includes("toast")) return Sandwich;
  if (n.includes("bebida") || n.includes("suco") || n.includes("shake")) return CupSoda;
  return ShoppingBag;
}

function inferCategoryDescription(name: string | null): string {
  if (!name) return "Ver todos os itens";
  const n = name.toLocaleLowerCase();
  if (n.includes("quente") || n.includes("cafe") || n.includes("caf")) return "Cafes e bebidas quentes";
  if (n.includes("gelad") || n.includes("ice") || n.includes("frappe") || n.includes("frap")) return "Refrescantes e gelados";
  if (n.includes("salgado") || n.includes("sanduiche") || n.includes("lanche")) return "Lanches e salgados";
  if (n.includes("doce") || n.includes("torta") || n.includes("brownie")) return "Sobremesas e doces";
  return "Itens desta categoria";
}

function ModernProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const options = hasOptions(product);
  const qty = qtyForBaseProduct(cart.items as any, product.id);
  const isBestSeller = Boolean((product as any).isBestSeller);
  const promotionPriceCents = (product as any).promotionPriceCents as number | null | undefined;

  function openDetails() {
    navigate(`/produto/${product.id}`);
  }

  function quickAdd() {
    if (options) {
      openDetails();
      return;
    }
    cart.add(product as any);
    showToast(`${product.name} adicionado!`);
  }

  function dec(e: React.MouseEvent) {
    e.stopPropagation();
    cart.dec(product.id);
  }

  function inc(e: React.MouseEvent) {
    e.stopPropagation();
    cart.inc(product.id);
  }

  return (
    <button
      type="button"
      onClick={quickAdd}
      className="relative flex flex-col items-center gap-1 rounded-2xl p-2 text-left transition active:scale-95 hover:shadow-md"
      style={{
        background: "#fff",
        border: `1.5px solid ${isBestSeller ? `${"var(--brand)"}55` : "rgba(107,79,58,0.1)"}`,
      }}
    >
      {isBestSeller && (
        <span
          className="absolute top-1 left-1 text-[8px] font-bold text-white rounded-full px-1.5 py-px leading-none"
          style={{ background: "var(--brand)" }}
        >
          Top
        </span>
      )}
      {options && (
        <span
          className="absolute top-1 right-1 text-[8px] font-bold text-white rounded-full px-1 py-px leading-none"
          style={{ background: "#6B4F3A" }}
        >
          +
        </span>
      )}
      <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[9px] font-bold opacity-40">SEM IMAGEM</span>
        )}
      </div>
      <span className="text-[11px] font-medium leading-tight text-center line-clamp-2 w-full" style={{ color: "var(--text)" }}>
        {product.name}
      </span>
      {promotionPriceCents != null ? (
        <span className="flex flex-col items-center leading-tight">
          <span className="text-[9px] line-through opacity-50">{formatBRL(product.priceCents)}</span>
          <span className="text-[11px] font-black text-emerald-600">{formatBRL(promotionPriceCents)}</span>
        </span>
      ) : (
        <span className="text-[11px] font-black" style={{ color: "var(--brand)" }}>{formatBRL(product.priceCents)}</span>
      )}
      {qty > 0 && <span className="text-[10px] opacity-60">{qty} no carrinho</span>}
      {!options && qty > 0 && (
        <div className="mt-1 hidden items-center gap-1.5 md:flex" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={dec}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--surface-2)" }}
            aria-label="Diminuir"
          >
            {qty === 1 ? <Trash2 size={12} className="text-red-400" /> : <Minus size={12} />}
          </button>
          <span className="w-5 text-center text-sm font-black tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={inc}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
            style={{ background: "var(--brand)" }}
            aria-label="Aumentar"
          >
            <Plus size={12} />
          </button>
        </div>
      )}
    </button>
  );
}
function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const cart = useCart();
  const hasItems = cart.items.length > 0;

  return (
    <div className="rounded-3xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black" style={{ color: "var(--text)" }}>Carrinho</h3>
        <span className="text-xs opacity-60">{cart.totalItems} itens</span>
      </div>

      <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
        {!hasItems && (
          <p className="py-6 text-center text-sm opacity-60">Seu carrinho está vazio.</p>
        )}
        {cart.items.map((item) => (
          <div key={item.product.id} className="flex items-center gap-2 rounded-2xl p-2" style={{ background: "var(--surface-2)" }}>
            <div className="h-10 w-10 overflow-hidden rounded-xl" style={{ background: "#eee" }}>
              {item.product.imageUrl ? (
                <img src={item.product.imageUrl} alt={item.product.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{item.product.name}</p>
              <p className="text-xs font-bold tabular-nums" style={{ color: "var(--brand)" }}>{formatBRL(item.product.priceCents)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => (item.qty === 1 ? cart.remove(item.product.id) : cart.dec(item.product.id))} className="h-6 w-6 rounded-full bg-white">
                <Minus size={11} className="mx-auto" />
              </button>
              <span className="w-5 text-center text-xs font-black">{item.qty}</span>
              <button type="button" onClick={() => cart.inc(item.product.id)} className="h-6 w-6 rounded-full text-white" style={{ background: "var(--brand)" }}>
                <Plus size={11} className="mx-auto" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs opacity-60">Subtotal</span>
          <span className="text-lg font-black tabular-nums">{formatBRL(cart.subtotalCents)}</span>
        </div>
        <button
          type="button"
          disabled={!hasItems}
          onClick={onCheckout}
          className="h-11 w-full rounded-2xl font-black text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #1C1209, #3D2314)" }}
        >
          Finalizar pedido
        </button>
      </div>
    </div>
  );
}

function ModernPublicCatalogContent() {
  const [categorySlug, setCategorySlug] = useState("");
  const [search, setSearch] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const navigate = useNavigate();
  const cart = useCart();

  const { data: storefront } = useStoreFront();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: products = [], isLoading: productsLoading } = useProducts(categorySlug || undefined, search || undefined);
  const brand = storefront?.storeName || "Catálogo";
  const brandColor = storefront?.primaryColor || "#C8953A";

  const categoryItems = useMemo(
    () => [{ id: "all", slug: "", name: "Todos" }, ...categories].map((cat) => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      icon: inferCategoryIcon(cat.name),
      description: inferCategoryDescription(cat.name),
    })),
    [categories],
  );

  return (
    <div className="min-h-dvh" style={{ background: "#F7F3EC", ["--brand" as string]: brandColor }}>
      <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] opacity-60">Catálogo online</p>
            <p className="truncate text-sm font-black">{brand}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-bold text-white lg:hidden"
            style={{ background: "linear-gradient(135deg, #1C1209, #3D2314)" }}
          >
            <ShoppingCart size={14} />
            <span>Carrinho</span>
            {cart.totalItems > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{cart.totalItems}</span>}
          </button>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-3">
          <div className="flex h-11 items-center gap-2 rounded-2xl border px-3" style={{ background: "#EEE8DD", borderColor: "#e6dccd" }}>
            <Search size={15} className="opacity-50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, código ou código de barras"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border p-2 h-full overflow-y-auto grid grid-cols-2 gap-1.5 content-start" style={{ background: "#fff", borderColor: "rgba(107,79,58,0.12)" }}>
            {categoriesLoading && <div className="h-16 rounded-2xl bg-[#F5EDE0] animate-pulse col-span-2" />}
            {!categoriesLoading &&
              categoryItems.map((c) => {
                const active = categorySlug === c.slug;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategorySlug(c.slug)}
                    className="w-full rounded-2xl px-1.5 py-2.5 transition-all"
                    style={active
                      ? { background: "var(--brand)", color: "#fff", boxShadow: "0 10px 24px color-mix(in srgb, var(--brand) 28%, transparent)" }
                      : { background: "#F5EDE0", color: "#1C1209", border: "1px solid rgba(107,79,58,0.1)" }}
                  >
                    <span className="flex flex-col items-center gap-1">
                      <span className="w-7 h-7 rounded-xl grid place-items-center" style={active ? { background: "rgba(255,255,255,0.18)" } : { background: "rgba(200,149,58,0.18)", color: "var(--brand)" }}>
                        <Icon size={15} />
                      </span>
                      <span className="text-[10px] font-extrabold leading-tight text-center line-clamp-2 w-full px-0.5">{c.name}</span>
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex gap-2 overflow-x-auto lg:hidden scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {categoryItems.map((c) => {
              const active = categorySlug === c.slug;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategorySlug(c.slug)}
                  className="shrink-0 min-w-[150px] rounded-2xl px-3 py-2 flex items-center gap-2 text-xs font-bold"
                  style={active
                    ? { background: "var(--brand)", color: "#fff", boxShadow: "0 4px 12px color-mix(in srgb, var(--brand) 28%, transparent)" }
                    : { background: "#fff", color: "#6B4F3A", border: "1px solid rgba(107,79,58,0.12)" }}
                >
                  <Icon size={15} />
                  <span className="text-left whitespace-normal break-words leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl" style={{ background: "#ece4d8" }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-3xl border p-8 text-center text-sm opacity-60" style={{ background: "#fff", borderColor: "#ece3d7" }}>
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {products.map((p) => <ModernProductCard key={p.id} product={p} />)}
            </div>
          )}
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <CartPanel onCheckout={() => navigate("/checkout")} />
          </div>
        </aside>
      </div>

      <div className={`fixed inset-0 z-50 items-end bg-black/45 p-3 lg:hidden ${mobileCartOpen ? "flex" : "hidden"}`}>
        <div className="w-full rounded-3xl bg-white p-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              className="rounded-full bg-gray-100 p-1"
            >
              <X size={14} />
            </button>
          </div>
          <CartPanel onCheckout={() => { setMobileCartOpen(false); navigate("/checkout"); }} />
        </div>
      </div>
    </div>
  );
}

export function ModernPublicCatalog() {
  return (
    <ToastProvider>
      <ModernPublicCatalogContent />
    </ToastProvider>
  );
}


