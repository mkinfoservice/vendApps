import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ShoppingCart, Search, X, AlertTriangle, LayoutGrid, Coffee, Snowflake, Sandwich, CupSoda, ShoppingBag, type LucideIcon } from "lucide-react";
import { resolveTenantFromHost, fetchTenantInfo } from "@/utils/tenant";
import { useCategories, useProducts, useStoreFront } from "./features/catalog/queries";
import { useCart } from "./features/cart/cart";
import { CartSheet } from "@/features/cart/CartSheet";
import { CartSidebar } from "@/features/cart/CartSidebar";
import { ProductCard } from "@/features/catalog/ProductCard";
import { ProductSection } from "@/features/catalog/ProductSection";
import { HeroBanner } from "@/components/HeroBanner";
import { TrustBar } from "@/components/TrustBar";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { ProductQuickViewModal } from "@/features/catalog/ProductQuickViewModal";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/Toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProductSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm animate-pulse h-full flex flex-col" style={{ background: "var(--surface)" }}>
      <div className="h-32 sm:h-40 lg:h-48 w-full shrink-0" style={{ background: "var(--surface-2)" }} />
      <div className="p-3 flex flex-col flex-1 justify-between">
        <div className="space-y-2">
          <div className="h-4 rounded w-3/4" style={{ background: "var(--surface-2)" }} />
          <div className="h-4 rounded w-1/2" style={{ background: "var(--surface-2)" }} />
        </div>
        <div className="mt-2 flex justify-between items-center">
          <div className="h-5 rounded w-20" style={{ background: "var(--surface-2)" }} />
          <div className="h-9 w-9 rounded-full" style={{ background: "var(--surface-2)" }} />
        </div>
      </div>
    </div>
  );
}

// Slug resolvido ao nível de módulo (mesma lógica de catalog/api.ts)
const _tenantSlug = resolveTenantFromHost();

export default function App() {
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);

  // Reset paginação ao trocar filtro
  useEffect(() => { setVisibleCount(24); }, [categorySlug, search]);

  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  // Lê config da loja (cor, logo, nome, slogan)
  const { data: storeFront } = useStoreFront();
  const brandColor = storeFront?.primaryColor ?? "#7c5cf8";

  // Propaga a cor para o documento inteiro (Checkout, ProductDetail etc. herdam)
  useEffect(() => {
    document.documentElement.style.setProperty("--brand", brandColor);
  }, [brandColor]);

  // Verifica status do tenant (só em subdomínio válido)
  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenantInfo,
    enabled: !!_tenantSlug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const categoriesQuery = useCategories();
  const productsQuery = useProducts(categorySlug || undefined, search || undefined);

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const categoryItems = useMemo(() => {
    const resolveIcon = (name: string): LucideIcon => {
      const n = name.toLocaleLowerCase();
      if (n.includes("quente") || n.includes("cafe") || n.includes("caf") || n.includes("espresso") || n.includes("capuccino")) return Coffee;
      if (n.includes("gelad") || n.includes("ice") || n.includes("frappe") || n.includes("frap") || n.includes("cold")) return Snowflake;
      if (n.includes("salgado") || n.includes("sanduiche") || n.includes("lanche") || n.includes("toast")) return Sandwich;
      if (n.includes("bebida") || n.includes("suco") || n.includes("shake")) return CupSoda;
      return ShoppingBag;
    };

    const resolveHint = (name: string): string => {
      const n = name.toLocaleLowerCase();
      if (n.includes("quente") || n.includes("cafe") || n.includes("caf")) return "Bebidas quentes";
      if (n.includes("gelad") || n.includes("ice") || n.includes("frappe") || n.includes("frap")) return "Refrescantes";
      if (n.includes("salgado") || n.includes("sanduiche") || n.includes("lanche")) return "Lanches";
      if (n.includes("doce") || n.includes("torta") || n.includes("brownie")) return "Sobremesas";
      return "Categoria";
    };

    return [
      { id: "all", name: "Todos", slug: "", icon: LayoutGrid, hint: "Catalogo completo" },
      ...categories.map((c) => ({
        ...c,
        icon: resolveIcon(c.name),
        hint: resolveHint(c.name),
      })),
    ];
  }, [categories]);
  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = products.length > visibleCount;
  const isLoading = categoriesQuery.isLoading || productsQuery.isLoading;

  const isFiltered = !!categorySlug || !!search;
  const featuredProducts = isFiltered ? [] : products.filter((p) => p.isFeatured).slice(0, 8);
  const bestSellers     = isFiltered ? [] : products.filter((p) => p.isBestSeller).slice(0, 8);

  const cart = useCart();

  // Empresa suspensa → tela de aviso (não renderiza loja)
  if (_tenantSlug && tenantQuery.isError && (tenantQuery.error as { status?: number })?.status === 403) {
    return (
      <div className="min-h-dvh font-sans flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-black mb-2" style={{ color: "var(--text)" }}>
            Loja temporariamente indisponível
          </h1>
          <p className="text-sm opacity-60" style={{ color: "var(--text-muted)" }}>
            Esta loja está em manutenção. Tente novamente em breve.
          </p>
        </div>
      </div>
    );
  }

  /** Botão do carrinho — usado tanto no TopBar quanto na bottom bar mobile */
  function CartIconButton() {
    return (
      <CartSheet>
        <button
          type="button"
          className="relative w-11 h-11 rounded-2xl flex items-center justify-center transition active:scale-95 border border-[var(--border)]"
          style={{ background: "var(--surface-2)" }}
          aria-label="Abrir carrinho"
        >
          <ShoppingCart className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          {cart.totalItems > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-black flex items-center justify-center"
              style={{ background: brandColor }}
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
      <div
        className="min-h-dvh font-sans overflow-x-hidden"
        style={{ background: "var(--bg)" }}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-40">
          {/* Announcement bar rotativa */}
          <AnnouncementBar
            messages={storeFront?.announcements ?? ["Frete Grátis acima de R$ 100"]}
            brandColor={brandColor}
          />

          {/* TopBar com branding + cart slot */}
          <TopBar
            cartSlot={<CartIconButton />}
            logoUrl={storeFront?.logoUrl}
            storeName={storeFront?.storeName}
            storeSlogan={storeFront?.storeSlogan}
            brandColor={brandColor}
          />
        </div>

        {/* Conteúdo principal */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 xl:gap-8 items-start">

            {/* Coluna esquerda: catálogo */}
            <div className={`min-w-0 xl:pb-10 ${cart.totalItems > 0 ? "pb-28" : "pb-6"}`}>

              {/* Banner principal — oculto quando há filtro ativo */}
              {!isFiltered && (
                <HeroBanner
                  onCategoryClick={setCategorySlug}
                  onProductClick={(id) =>
                    isDesktop ? setSelectedProductId(id) : navigate(`/produto/${id}`)
                  }
                />
              )}

              {/* Trust badges */}
              {!isFiltered && <TrustBar />}

              {/* Barra de busca */}
              <div className="mt-5 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-40" style={{ color: "var(--text-muted)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full h-12 pl-10 pr-10 rounded-2xl border text-sm outline-none shadow-sm transition focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                />
                {(search || categorySlug) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setCategorySlug(""); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center opacity-40 hover:opacity-70 transition"
                    style={{ color: "var(--text-muted)" }}
                    aria-label="Limpar filtros"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Categorias — pills com fade nas bordas para indicar scroll */}
              <div className="mt-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
                {categories.length > 0 && (
                  <aside className="hidden lg:block">
                    <div
                      className="rounded-3xl p-2.5 space-y-1.5 border sticky top-24"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      {categoryItems.map((item) => {
                        const Icon = item.icon;
                        const active = categorySlug === item.slug;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCategorySlug(item.slug)}
                            className="w-full text-left rounded-2xl px-3 py-2.5 transition-all"
                            style={active
                              ? { background: "var(--brand)", color: "#fff", boxShadow: "0 10px 24px rgba(0,0,0,0.12)" }
                              : { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                className="w-8 h-8 rounded-xl grid place-items-center"
                                style={active ? { background: "rgba(255,255,255,0.18)" } : { background: "rgba(124,92,248,0.12)", color: "var(--brand)" }}
                              >
                                <Icon size={16} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-extrabold truncate">{item.name}</span>
                                <span className="block text-[11px] opacity-75 truncate">{item.hint}</span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                )}

                <div className="min-w-0">
                  {categories.length > 0 && (
                    <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {categoryItems.map((item) => {
                        const Icon = item.icon;
                        const active = categorySlug === item.slug;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCategorySlug(item.slug)}
                            className="shrink-0 rounded-2xl px-3 py-2 flex items-center gap-2 text-xs font-bold whitespace-nowrap transition-all"
                            style={active
                              ? { background: "var(--brand)", color: "#fff" }
                              : { background: "var(--surface)", color: "var(--text-muted)", border: "1.5px solid var(--border)" }}
                          >
                            <Icon size={15} />
                            <span>{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

              {/* Seções de destaque — só na homepage (sem filtro) */}
              {!isLoading && (
                <>
                  <ProductSection
                    title={<>🔥 Destaques do Dia</>}
                    products={featuredProducts}
                    onCardClick={setSelectedProductId}
                    isDesktop={isDesktop}
                  />
                  <ProductSection
                    title={<>📈 Mais Vendidos</>}
                    products={bestSellers}
                    onCardClick={setSelectedProductId}
                    isDesktop={isDesktop}
                  />
                </>
              )}

              {/* Grid de produtos */}
              <div className="mt-6 min-w-0" id="products">
                {(featuredProducts.length > 0 || bestSellers.length > 0) && !isFiltered && (
                  <h2 className="text-base font-black mb-3" style={{ color: "var(--text)" }}>Todos os Produtos</h2>
                )}
                {isLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <ProductSkeleton key={i} />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-base font-semibold opacity-50" style={{ color: "var(--text-muted)" }}>
                      Nenhum produto encontrado.
                    </p>
                    <p className="text-sm mt-1 opacity-40" style={{ color: "var(--text-muted)" }}>
                      Tente buscar com outros termos.
                    </p>
                    <button
                      type="button"
                      className="mt-4 text-sm font-semibold underline underline-offset-2"
                      style={{ color: "var(--brand)" }}
                      onClick={() => { setSearch(""); setCategorySlug(""); }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                      {visibleProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          p={p as any}
                          onCardClick={isDesktop ? () => setSelectedProductId(p.id) : undefined}
                        />
                      ))}
                    </div>

                    {/* Paginação — carregar mais */}
                    {hasMore && (
                      <div className="mt-8 flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((n) => n + 24)}
                          className="h-11 px-8 rounded-2xl border-2 text-sm font-bold transition-all hover:text-white hover:border-transparent active:scale-95"
                          style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                          onMouseEnter={e => { e.currentTarget.style.background = brandColor; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = brandColor; }}
                        >
                          Ver mais produtos
                        </button>
                        <span className="text-xs text-gray-400">
                          {visibleCount} de {products.length} produtos
                        </span>
                      </div>
                    )}
                  </>
                )}
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita: sidebar apenas em xl+ */}
            <aside className="hidden xl:block w-[360px] shrink-0 sticky top-24 h-fit">
              <CartSidebar />
            </aside>

          </div>
        </div>

        {/* Bottom bar — visível abaixo de xl apenas quando há itens */}
        {cart.totalItems > 0 && (
          <div
            className="xl:hidden fixed left-0 right-0 bottom-0 z-40 border-t border-[var(--border)] shadow-[0_-8px_24px_rgba(28,18,9,0.12)]"
            style={{ background: "var(--surface)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center gap-3">
              {/* Ícone do carrinho com badge */}
              <div
                className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${brandColor}18` }}
              >
                <ShoppingCart className="w-5 h-5" style={{ color: brandColor }} />
                <span
                  className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-black flex items-center justify-center"
                  style={{ background: brandColor }}
                >
                  {cart.totalItems > 9 ? "9+" : cart.totalItems}
                </span>
              </div>

              {/* Totais */}
              <div className="flex-1 min-w-0">
                <div className="font-black tabular-nums text-base leading-tight" style={{ color: "var(--text)" }}>
                  {formatBRL(cart.subtotalCents)}
                </div>
                <div className="text-xs leading-tight opacity-50" style={{ color: "var(--text-muted)" }}>
                  {cart.totalItems} item{cart.totalItems !== 1 ? "s" : ""} no carrinho
                </div>
              </div>

              <CartSheet>
                <button
                  type="button"
                  className="h-12 px-5 rounded-2xl font-black text-sm text-white transition hover:brightness-110 active:scale-95 shrink-0"
                  style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
                >
                  Ver carrinho →
                </button>
              </CartSheet>
            </div>
          </div>
        )}
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
