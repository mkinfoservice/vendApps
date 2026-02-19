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
    <>
      {/* =========================
          [1] PAGE BACKGROUND (tema geral + altura mínima)
      ========================== */}
      <div className="mx-auto w-full max-w-[1200px] px-0 pb-24">

        {/* =========================
            [2] APP SHELL (centraliza + largura máxima no desktop)
            - max-w-6xl evita esticar demais no monitor grande
            - pb-28 reserva espaço para a bottom bar no mobile
        ========================== */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-24">
          {/* =========================
              [3] RESPONSIVE GRID
              - mobile: 1 coluna
              - desktop: 2 colunas (catálogo + sidebar carrinho)
          ========================== */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* =========================
                [4] LEFT COLUMN (CATÁLOGO)
            ========================== */}
            <div>
              {/* =========================
                  [4.1] TOP HEADER (título + categoria ativa + resumo carrinho)
              ========================== */}
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

              {/* =========================
                  [4.2] SEARCH BAR (campo + botão limpar)
              ========================== */}
              <div className="mt-3 flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-white/40 focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategorySlug("");
                  }}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold hover:bg-white/10"
                >
                  Limpar
                </button>
              </div>

              {/* =========================
                  [4.3] HERO BANNER (banner principal)
              ========================== */}
              <HeroMarket
              onPrimaryClick={() => {
                const el = document.getElementById("products");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
              </HeroMarket>

              {/* =========================
                  [4.4] CATEGORY SECTION (tiles horizontal)
              ========================== */}
              <div className="mt-5">
                <div className="flex items-end justify-between">
                  <div className="text-white font-black text-lg">Categorias</div>
                  <button
                    type="button"
                    className="text-xs text-white/70 hover:text-white"
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

              {/* =========================
                  [4.5] PRODUCTS SECTION (responsivo)
                  - mobile: 1 coluna
                  - tablet: 2 colunas
                  - desktop com sidebar: 1 coluna novamente (não aperta)
              ========================== */}
              <div className="mt-6" id ="products">
                <div className="text-white font-black text-lg">Produtos</div>

                {isLoading ? (
                  <p className="text-white/70 mt-3">Carregando...</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {products.map((p) => (
                      <ProductRow key={p.id} p={p as any} />
                    ))}

                    {products.length === 0 ? (
                      <p className="text-white/70">Nenhum produto encontrado.</p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* =========================
                [5] RIGHT COLUMN (DESKTOP ONLY) — RESUMO / CARRINHO
                - aparece apenas em telas grandes (lg)
                - sticky para ficar sempre visível no scroll
            ========================== */}
            
          </div>
        </div>

        {/* =========================
            [6] MOBILE BOTTOM BAR (somente mobile/tablet)
            - fixo no rodapé
            - subtotal + botão "Ver carrinho"
        ========================== */}
        <div className="lg:hidden fixed left-0 right-0 bottom-0 border-t border-white/10 bg-white/80 text-black backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center gap-3">
            {/* [6.1] Totais */}
            <div className="flex-1">
              <div className="font-black tabular-nums">{formatBRL(cart.subtotalCents)}</div>
              <div className="text-xs opacity-70">{cart.totalItems} item(ns)</div>
            </div>

            {/* [6.2] CTA carrinho */}
            <CartSheet>
              <button
                type="button"
                className="h-12 px-5 rounded-2xl bg-black text-white font-extrabold"
              >
                Ver carrinho ({cart.totalItems})
              </button>
            </CartSheet>
          </div>
        </div>
      </div>
    </>
  );
}
