import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
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

function ModernProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const options = hasOptions(product);
  const qty = qtyForBaseProduct(cart.items as any, product.id);

  function openDetails() {
    navigate(`/produto/${product.id}`);
  }

  function quickAdd(e: React.MouseEvent) {
    e.stopPropagation();
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
      onClick={openDetails}
      className="w-full rounded-3xl border p-2.5 text-left transition hover:shadow-md active:scale-[0.99]"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="relative">
        <div className="aspect-square overflow-hidden rounded-2xl" style={{ background: "var(--surface-2)" }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl opacity-30">☕</div>
          )}
        </div>
        <button
          type="button"
          onClick={quickAdd}
          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow"
          style={{ background: "#5a3824" }}
          aria-label={options ? "Personalizar produto" : "Adicionar produto"}
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="pt-2">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold" style={{ color: "var(--text)" }}>
          {product.name}
        </p>
        <p className="mt-1 text-sm font-black tabular-nums" style={{ color: "var(--brand)" }}>
          {formatBRL(product.priceCents)}
        </p>

        {qty > 0 && (
          <p className="mt-1 text-[11px] font-semibold opacity-65">
            {qty} no carrinho
          </p>
        )}

        {!options && qty > 0 && (
          <div className="mt-2 hidden items-center gap-1.5 md:flex">
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
      </div>
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

  const categoryItems = useMemo(() => [{ id: "all", slug: "", name: "Todos" }, ...categories], [categories]);

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
              placeholder="Buscar produto..."
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
          <div className="sticky top-24 space-y-2 rounded-3xl border p-3" style={{ background: "#EFEAE0", borderColor: "#e8dfd3" }}>
            {categoriesLoading && <div className="h-8 rounded-xl bg-white/60" />}
            {!categoriesLoading &&
              categoryItems.map((c) => {
                const active = categorySlug === c.slug;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategorySlug(c.slug)}
                    className="w-full rounded-2xl px-3 py-2 text-left text-sm font-bold transition"
                    style={active ? { background: "#C8953A", color: "#fff" } : { background: "#F7F3EC", color: "#3D2A1C" }}
                  >
                    {c.name}
                  </button>
                );
              })}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex gap-2 overflow-x-auto lg:hidden">
            {categoryItems.map((c) => {
              const active = categorySlug === c.slug;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategorySlug(c.slug)}
                  className="shrink-0 rounded-2xl px-4 py-2 text-xs font-bold"
                  style={active ? { background: "#1C1209", color: "#fff" } : { background: "#EEE8DD", color: "#5f4a39" }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-3xl" style={{ background: "#ece4d8" }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-3xl border p-8 text-center text-sm opacity-60" style={{ background: "#fff", borderColor: "#ece3d7" }}>
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
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
