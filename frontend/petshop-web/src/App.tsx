import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ShoppingCart, Search, X } from "lucide-react";
import { useCategories, useProducts } from "./features/catalog/queries";
import { useCart } from "./features/cart/cart";
import { CartSheet } from "@/features/cart/CartSheet";
import { CartSidebar } from "@/features/cart/CartSidebar";
import { CategoryTile } from "@/features/catalog/CategoryTile";
import { ProductCard } from "@/features/catalog/ProductCard";
import { ProductQuickViewModal } from "@/features/catalog/ProductQuickViewModal";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/Toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm animate-pulse h-full flex flex-col">
      <div className="h-32 sm:h-40 lg:h-48 w-full bg-gray-200 shrink-0" />
      <div className="p-3 flex flex-col flex-1 justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="mt-2 flex justify-between items-center">
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="h-9 w-9 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const isDesktop = useMediaQuery("(min-width: 1280px)");

  const categoriesQuery = useCategories();
  const productsQuery = useProducts(categorySlug || undefined, search || undefined);

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const isLoading = categoriesQuery.isLoading || productsQuery.isLoading;

  const cart = useCart();

  /** Botão do carrinho — usado tanto no TopBar quanto na bottom bar mobile */
  function CartIconButton() {
    return (
      <CartSheet>
        <button
          type="button"
          className="relative w-11 h-11 rounded-2xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition active:scale-95"
          aria-label="Abrir carrinho"
        >
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          {cart.totalItems > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-black flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
            >
              {cart.totalItems > 9 ? "9+" : cart.totalItems}
            </span>
          )}
        </button>
      </CartSheet>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-gray-50 font-sans overflow-x-hidden">
        {/* Sticky header */}
        <div className="sticky top-0 z-40">
          {/* Banner frete grátis */}
          <div
            className="text-white text-center text-xs font-semibold py-2 px-4"
            style={{ background: "linear-gradient(90deg, #7c5cf8, #6d4df2)" }}
          >
            Frete Grátis acima de R$ 100
          </div>

          {/* TopBar com branding + cart slot */}
          <TopBar cartSlot={<CartIconButton />} />
        </div>

        {/* Conteúdo principal */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 xl:gap-8 items-start">

            {/* Coluna esquerda: catálogo */}
            <div className="pb-28 xl:pb-10 min-w-0">

              {/* Barra de busca */}
              <div className="mt-4 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full h-12 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] shadow-sm transition"
                />
                {(search || categorySlug) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setCategorySlug(""); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
                    aria-label="Limpar filtros"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Categorias — pills horizontal scroll */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <CategoryTile
                  c={{ id: "all", name: "Todos", slug: "" }}
                  active={!categorySlug}
                  onClick={() => setCategorySlug("")}
                />
                {categories.map((c) => (
                  <CategoryTile
                    key={c.id}
                    c={c}
                    active={categorySlug === c.slug}
                    onClick={() => setCategorySlug(c.slug)}
                  />
                ))}
              </div>

              {/* Grid de produtos */}
              <div className="mt-6 min-w-0" id="products">
                {isLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <ProductSkeleton key={i} />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-base font-semibold text-gray-400">
                      Nenhum produto encontrado.
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Tente buscar com outros termos.
                    </p>
                    <button
                      type="button"
                      className="mt-4 text-sm font-semibold underline underline-offset-2"
                      style={{ color: "#7c5cf8" }}
                      onClick={() => { setSearch(""); setCategorySlug(""); }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                    {products.map((p) => (
                      <ProductCard
                        key={p.id}
                        p={p as any}
                        onCardClick={isDesktop ? () => setSelectedProductId(p.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coluna direita: sidebar apenas em xl+ */}
            <aside className="hidden xl:block w-[360px] shrink-0 sticky top-24 h-fit">
              <CartSidebar />
            </aside>

          </div>
        </div>

        {/* Bottom bar — visível abaixo de xl (sem sidebar) */}
        <div className="xl:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-black tabular-nums text-gray-900 text-base">
                {formatBRL(cart.subtotalCents)}
              </div>
              <div className="text-xs text-gray-400">
                {cart.totalItems} item{cart.totalItems !== 1 ? "s" : ""}
              </div>
            </div>

            <CartSheet>
              <button
                type="button"
                disabled={cart.totalItems === 0}
                className="h-12 px-6 rounded-2xl font-black text-sm text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                Ver carrinho ({cart.totalItems})
              </button>
            </CartSheet>
          </div>
        </div>
      </div>

      {/* Quick View Modal — apenas desktop (xl+) */}
      <AnimatePresence>
        {selectedProductId && (
          <ProductQuickViewModal
            key={selectedProductId}
            productId={selectedProductId}
            onClose={() => setSelectedProductId(null)}
          />
        )}
      </AnimatePresence>
    </ToastProvider>
  );
}
