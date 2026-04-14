import { ChevronLeft, ChevronRight, ShoppingCart, Minus, Plus, Check } from "lucide-react";
import type { Product } from "./api";
import { useProductStepper } from "./useProductStepper";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  product: Product;
  onConfirm: (synthetic: Product, qty: number) => void;
  onCancel: () => void;
}

/**
 * Fluxo step-by-step para seleção de adicionais.
 * Usado dentro do ProductQuickViewModal (desktop) e ProductDetail (mobile).
 */
export function ProductAddonStepper({ product, onConfirm, onCancel }: Props) {
  const {
    groups,
    step,
    qty,
    setQty,
    currentGroup,
    isFirstStep,
    isLastStep,
    selectedIdsForStep,
    canAdvance,
    totalCents,
    goNext,
    goBack,
    toggle,
    buildSynthetic,
  } = useProductStepper(product);

  if (!currentGroup) return null;

  const isSingle = currentGroup.selectionType === "single";

  function handleAdd() {
    onConfirm(buildSynthetic(), qty);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Cabeçalho da etapa ──────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        {/* Barra de progresso */}
        <div className="flex items-center gap-1.5 mb-3">
          {groups.map((g, i) => (
            <div
              key={g.id}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step
                  ? "flex-1 bg-[var(--brand)]"
                  : i < step
                  ? "w-4 bg-[var(--brand)]/40"
                  : "w-4 bg-gray-200"
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] text-gray-400 shrink-0 tabular-nums">
            {step + 1} / {groups.length}
          </span>
        </div>

        {/* Título + badge */}
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base text-gray-900 leading-tight">
            {currentGroup.name}
          </h3>
          {currentGroup.isRequired ? (
            <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Obrigatório
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              Opcional
            </span>
          )}
        </div>

        {/* Dica de seleção */}
        <p className="mt-0.5 text-xs text-gray-400">
          {isSingle
            ? "Escolha uma opção"
            : currentGroup.maxSelections > 0
            ? `Escolha até ${currentGroup.maxSelections} opções`
            : "Escolha quantas quiser"}
        </p>
      </div>

      {/* ── Lista de opções ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2 min-h-0">
        {currentGroup.addons.map((addon) => {
          const isSelected = selectedIdsForStep.has(addon.id);
          return (
            <button
              key={addon.id}
              type="button"
              onClick={() => {
                toggle(addon.id);
                // Single-selection: avança automaticamente após escolha, exceto na última etapa
                if (isSingle && !isLastStep) {
                  setTimeout(() => goNext(), 180);
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all duration-150 text-left ${
                isSelected
                  ? "border-[var(--brand)] bg-[var(--brand)]/5 shadow-sm"
                  : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              {/* Indicador radio / checkbox */}
              <div
                className={`shrink-0 flex items-center justify-center transition-all ${
                  isSingle
                    ? `w-5 h-5 rounded-full border-2 ${
                        isSelected
                          ? "border-[var(--brand)]"
                          : "border-gray-300"
                      }`
                    : `w-5 h-5 rounded-md border-2 ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)]"
                          : "border-gray-300"
                      }`
                }`}
              >
                {isSingle && isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                )}
                {!isSingle && isSelected && (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
              </div>

              <span className="flex-1 text-sm font-medium text-gray-800">
                {addon.name}
              </span>

              <span
                className={`text-sm font-semibold shrink-0 ${
                  addon.priceCents > 0 ? "text-[var(--brand)]" : "text-gray-400"
                }`}
              >
                {addon.priceCents === 0 ? "Grátis" : `+${formatBRL(addon.priceCents)}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Quantidade + total (última etapa) ───────────────── */}
      {isLastStep && (
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">Quantidade</span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
                aria-label="Diminuir"
              >
                <Minus className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <span className="w-5 text-center text-sm font-bold text-gray-900 tabular-nums select-none">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-8 h-8 rounded-full text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
                style={{ background: "var(--brand)" }}
                aria-label="Aumentar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">Total</span>
            <span className="font-black text-lg tabular-nums" style={{ color: "var(--brand)" }}>
              {formatBRL(totalCents * qty)}
            </span>
          </div>
        </div>
      )}

      {/* ── Navegação ───────────────────────────────────────── */}
      <div className="px-4 pb-4 pt-3 border-t border-gray-100 flex gap-2.5 shrink-0">
        {/* Voltar / Cancelar */}
        {isFirstStep ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 rounded-2xl border border-gray-200 font-semibold text-sm text-gray-400 flex items-center justify-center hover:bg-gray-50 active:scale-[0.99] transition"
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="flex-1 h-12 rounded-2xl border border-gray-200 font-semibold text-sm text-gray-600 flex items-center justify-center gap-1 hover:bg-gray-50 active:scale-[0.99] transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
        )}

        {/* Próximo / Adicionar */}
        {isLastStep ? (
          <button
            type="button"
            onClick={handleAdd}
            className="flex-[2] h-12 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition"
            style={{ background: "var(--brand)" }}
          >
            <ShoppingCart className="w-4 h-4" />
            Adicionar
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className="flex-[2] h-12 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99] transition"
            style={{ background: "var(--brand)" }}
          >
            Próximo
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
