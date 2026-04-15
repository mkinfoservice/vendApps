import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingCart, Minus, Plus } from "lucide-react";
import { useProduct } from "@/features/catalog/queries";
import { useCart } from "@/features/cart/cart";
import { ToastProvider, useToast } from "@/components/Toast";
import { useBrandVar } from "@/hooks/useBrandVar";
import { ProductAddonStepper } from "@/features/catalog/ProductAddonStepper";
import type { Product } from "@/features/catalog/api";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProductDetailSkeleton() {
  return (
    <div className="min-h-dvh bg-white flex flex-col max-w-2xl mx-auto animate-pulse">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center px-4 gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 flex justify-center pr-9">
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
      </div>
      <div className="w-full h-72 bg-gray-200 shrink-0" />
      <div className="p-5 space-y-4">
        <div className="h-7 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="mt-4 flex justify-between">
          <div className="h-8 bg-gray-200 rounded w-24" />
          <div className="h-9 bg-gray-200 rounded w-32" />
        </div>
      </div>
    </div>
  );
}

function ProductDetailContent() {
  useBrandVar();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id ?? "");
  const cart = useCart();
  const { showToast } = useToast();
  const [qty, setQty] = useState(1);

  if (isLoading) return <ProductDetailSkeleton />;

  if (!product) {
    return (
      <div className="min-h-dvh bg-white flex flex-col max-w-2xl mx-auto">
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-gray-900 pr-9">
            Detalhes do Produto
          </h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6">
          <p className="text-base font-semibold text-gray-400">Produto não encontrado.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm font-semibold underline underline-offset-2"
            style={{ color: "var(--brand)" }}
          >
            Voltar ao catálogo
          </button>
        </div>
      </div>
    );
  }

  const img = product.imageUrl || "https://picsum.photos/seed/pet/800/600";
  const hasStepper = (product.addonGroups?.length ?? 0) > 0 || (product.variants?.length ?? 0) > 0;

  function handleSimpleAdd() {
    for (let i = 0; i < qty; i++) cart.add(product as any);
    showToast(
      qty > 1
        ? `${qty}x ${product!.name} adicionados!`
        : `${product!.name} adicionado!`
    );
    navigate(-1);
  }

  function handleStepperConfirm(synthetic: Product, confirmedQty: number) {
    for (let i = 0; i < confirmedQty; i++) cart.add(synthetic as any);
    showToast(
      confirmedQty > 1
        ? `${confirmedQty}x ${synthetic.name} adicionados!`
        : `${synthetic.name} adicionado!`
    );
    navigate(-1);
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col max-w-2xl mx-auto relative">
      {/* AppBar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center px-4 shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-gray-900 pr-9 truncate">
          {product.name}
        </h1>
      </div>

      {/* Hero image */}
      <div
        className="relative w-full shrink-0 overflow-hidden bg-gray-100"
        style={{ height: "min(280px, 44vw + 60px)" }}
      >
        <img
          src={img}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {hasStepper ? (
        /* ── Modo stepper (mobile fullscreen) ─────────────── */
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Preço base */}
          <div className="px-5 pt-4 pb-2 border-b border-gray-100 shrink-0">
            <p className="text-xs text-gray-400">
              a partir de{" "}
              <span className="font-bold" style={{ color: "var(--brand)" }}>
                {formatBRL(product.priceCents)}
              </span>
            </p>
          </div>
          <ProductAddonStepper
            product={product}
            onConfirm={handleStepperConfirm}
            onCancel={() => navigate(-1)}
          />
        </div>
      ) : (
        /* ── Modo simples ──────────────────────────────────── */
        <>
          <div className="flex-1 overflow-y-auto pb-32">
            <div className="p-5">
              <h2 className="font-bold text-2xl text-gray-900 leading-tight">{product.name}</h2>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Preço</p>
                  <span className="text-2xl font-black tabular-nums" style={{ color: "var(--brand)" }}>
                    {formatBRL(product.priceCents)}
                  </span>
                </div>

                <div className="shrink-0">
                  <p className="text-xs text-gray-400 mb-1 text-right">Quantidade</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
                      aria-label="Diminuir"
                    >
                      <Minus className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="w-6 text-center text-base font-bold text-gray-900 tabular-nums select-none">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => q + 1)}
                      className="w-9 h-9 rounded-full text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
                      style={{ background: "var(--brand)" }}
                      aria-label="Aumentar"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 divide-y divide-gray-100 border-t border-gray-100">
                <div className="py-3.5 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Categoria</span>
                  <span className="font-semibold text-gray-900">{product.category?.name ?? "—"}</span>
                </div>
                <div className="py-3.5 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Entrega</span>
                  <span className="font-semibold text-green-500">Entrega rápida disponível</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="max-w-2xl mx-auto">
              <button
                type="button"
                onClick={handleSimpleAdd}
                className="w-full h-14 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition"
                style={{ background: "var(--brand)" }}
              >
                <ShoppingCart className="w-5 h-5" />
                Adicionar ao Carrinho
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductDetail() {
  return (
    <ToastProvider>
      <ProductDetailContent />
    </ToastProvider>
  );
}
