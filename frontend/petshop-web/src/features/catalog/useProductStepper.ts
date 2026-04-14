import { useState } from "react";
import type { Product, ProductAddon, ProductAddonGroup } from "./api";

export type StepperSelections = Map<string, Set<string>>;

export interface ProductStepperState {
  groups: ProductAddonGroup[];
  step: number;
  qty: number;
  setQty: (qty: number | ((q: number) => number)) => void;
  currentGroup: ProductAddonGroup;
  isFirstStep: boolean;
  isLastStep: boolean;
  selections: StepperSelections;
  selectedIdsForStep: Set<string>;
  canAdvance: boolean;
  totalCents: number;
  goNext: () => void;
  goBack: () => void;
  toggle: (addonId: string) => void;
  buildSynthetic: () => Product;
}

/** Inicializa o Map de seleções com adicionais marcados como default. */
function buildInitialSelections(groups: ProductAddonGroup[]): StepperSelections {
  const init: StepperSelections = new Map();
  for (const g of groups) {
    const defaultAddon = g.addons.find(
      (a) => a.isDefault ||
             a.name.toLowerCase().includes("(padrão)") ||
             a.name.toLowerCase().includes("(padrao)")
    );
    if (defaultAddon) {
      init.set(g.id, new Set([defaultAddon.id]));
    }
  }
  return init;
}

export function useProductStepper(product: Product): ProductStepperState {
  const groups = product.addonGroups ?? [];
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<StepperSelections>(() => buildInitialSelections(groups));

  const currentGroup = groups[step];

  function toggle(addonId: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(currentGroup.id) ?? []);

      if (currentGroup.selectionType === "single") {
        // Radio: substitui seleção
        next.set(currentGroup.id, new Set([addonId]));
      } else {
        // Checkbox: verifica limite máximo
        if (current.has(addonId)) {
          current.delete(addonId);
        } else {
          const max = currentGroup.maxSelections;
          if (max > 0 && current.size >= max) return prev; // limite atingido
          current.add(addonId);
        }
        next.set(currentGroup.id, current);
      }
      return next;
    });
  }

  function isStepValid(groupIndex: number): boolean {
    const g = groups[groupIndex];
    if (!g || !g.isRequired) return true;
    const selected = selections.get(g.id);
    const count = selected?.size ?? 0;
    const min = g.minSelections > 0 ? g.minSelections : 1;
    return count >= min;
  }

  const selectedIdsForStep: Set<string> = selections.get(currentGroup?.id ?? "") ?? new Set();
  const canAdvance = isStepValid(step);

  const totalCents =
    product.priceCents +
    groups.reduce((sum, g) => {
      const selectedIds = selections.get(g.id) ?? new Set();
      return (
        sum +
        g.addons
          .filter((a) => selectedIds.has(a.id))
          .reduce((s, a) => s + a.priceCents, 0)
      );
    }, 0);

  function buildSynthetic(): Product {
    const selectedAddons: ProductAddon[] = [];
    for (const g of groups) {
      const ids = selections.get(g.id) ?? new Set();
      selectedAddons.push(...g.addons.filter((a) => ids.has(a.id)));
    }

    const extraCents = selectedAddons.reduce((s, a) => s + a.priceCents, 0);

    const nameParts = [
      product.name,
      ...groups
        .map((g) => {
          const ids = selections.get(g.id) ?? new Set();
          return g.addons
            .filter((a) => ids.has(a.id))
            .map((a) => a.name)
            .join(", ");
        })
        .filter(Boolean),
    ];

    const addonIdsPart = groups
      .flatMap((g) => [...(selections.get(g.id) ?? [])])
      .sort()
      .join("_");

    return {
      ...product,
      id: addonIdsPart ? `${product.id}__${addonIdsPart}` : product.id,
      name: nameParts.join(" · "),
      priceCents: product.priceCents + extraCents,
    };
  }

  return {
    groups,
    step,
    qty,
    setQty,
    currentGroup,
    isFirstStep: step === 0,
    isLastStep: step === groups.length - 1,
    selections,
    selectedIdsForStep,
    canAdvance,
    totalCents,
    goNext: () => setStep((s) => Math.min(s + 1, groups.length - 1)),
    goBack: () => setStep((s) => Math.max(s - 1, 0)),
    toggle,
    buildSynthetic,
  };
}
