import { useMemo, useState } from "react";
import { useCategories, useProducts } from "./features/catalog/queries";
import { useCart } from "./features/cart/cart";
import { CartSheet } from "@/features/cart/CartSheet";
import { CategoryTile } from "@/features/catalog/CategoryTile";
import { ProductRow } from "@/features/catalog/ProductRow";
import { TopBar } from "@/components/TopBar";
import { HeroMarket } from "./components/HeroMarket";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function App() {
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [search, setSearch] = useState("");

  const categoriesQuery = useCategories();
  const productsQuery = useProducts(categorySlug || undefined, search || undefined);

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const isLoading = categoriesQuery.isLoading || productsQuery.isLoading;

  const cart = useCart();

  const activeCategoryName = useMemo(() => {
    if (!categorySlug) return "Todas";
    return categories.find((c) => c.slug === categorySlug)?.name ?? "Categoria";
  }, [categorySlug, categories]);

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[1200px] px-0 pb-24">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

            {/* Left column: catálogo */}
            <div>
              {/* TopBar com carrinho */}
              <CartSheet>
                <div>
                  <TopBar
                    activeCategoryName={activeCategoryName}
                    subtotalLabel={formatBRL(cart.subtotalCents)}
                    totalItems={cart.totalItems}
                    onOpenCart={() => {}}
                  />
                </div>
              </CartSheet>

              {/* Search bar */}
              <div className="mt-3 flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="flex-1 h-11 rounded-xl border px-3 text-sm outline-none transition"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--surface)",
                    color: "var(--text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => { setSearch(""); setCategorySlug(""); }}
                  className="h-11 rounded-xl border px-4 text-sm font-bold transition hover:bg-[var(--surface-2)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  Limpar
                </button>
              </div>

              {/* Hero banner */}
              <HeroMarket
                onPrimaryClick={() => {
                  const el = document.getElementById("products");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />

              {/* Categorias */}
              <div className="mt-5">
                <div className="flex items-end justify-between">
                  <div className="font-black text-lg text-[var(--text)]">Categorias</div>
                  <button
                    type="button"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition"
                    onClick={() => setCategorySlug("")}
                  >
                    Ver todas
                  </button>
                </div>

                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  <CategoryTile
                    c={{ id: "all", name: "Todas", slug: "" }}
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
              </div>

              {/* Produtos */}
              <div className="mt-6" id="products">
                <div className="font-black text-lg text-[var(--text)]">Produtos</div>
                {isLoading ? (
                  <p className="text-[var(--text-muted)] mt-3">Carregando...</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {products.map((p) => (
                      <ProductRow key={p.id} p={p as any} />
                    ))}
                    {products.length === 0 ? (
                      <p className="text-[var(--text-muted)]">Nenhum produto encontrado.</p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Mobile bottom bar */}
        <div
          className="lg:hidden fixed left-0 right-0 bottom-0 border-t backdrop-blur-xl"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "rgba(13,17,28,0.92)",
          }}
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-black tabular-nums text-[var(--text)]">{formatBRL(cart.subtotalCents)}</div>
              <div className="text-xs text-[var(--text-muted)]">{cart.totalItems} item(ns)</div>
            </div>

            <CartSheet>
              <button
                type="button"
                className="h-12 px-5 rounded-2xl font-extrabold text-white transition"
                style={{ backgroundColor: "#7c5cf8" }}
              >
                Ver carrinho ({cart.totalItems})
              </button>
            </CartSheet>
          </div>
        </div>
      </div>
    </div>
  );
}
