import { useMemo, useState } from "react";
import type { Product, ProductAddon, ProductAddonGroup, ProductVariant } from "./api";
import { encodeSyntheticProductId } from "./syntheticProductId";

export type StepperSelections = Map<string, Set<string>>;

export type StepperStep =
  | VariantStep
  | AddonStep;

type VariantStep = {
      kind: "variant";
      id: string;
      name: string;
      isRequired: true;
      selectionType: "single";
      variants: ProductVariant[];
    };

type AddonStep = {
      kind: "addon";
      id: string;
      name: string;
      isRequired: boolean;
      selectionType: "single" | "multiple";
      minSelections: number;
      maxSelections: number;
      addons: ProductAddon[];
    };

export interface ProductStepperState {
  steps: StepperStep[];
  step: number;
  qty: number;
  setQty: (qty: number | ((q: number) => number)) => void;
  currentStep: StepperStep;
  isFirstStep: boolean;
  isLastStep: boolean;
  selections: StepperSelections;
  selectedIdsForStep: Set<string>;
  selectedVariantIdForStep: string | null;
  canAdvance: boolean;
  totalCents: number;
  goNext: () => void;
  goBack: () => void;
  toggle: (addonId: string) => void;
  selectVariant: (variantId: string) => void;
  buildSynthetic: () => Product;
}

function buildInitialAddonSelections(groups: ProductAddonGroup[]): StepperSelections {
  const init: StepperSelections = new Map();
  for (const g of groups) {
    const defaultAddon = g.addons.find(
      (a) =>
        a.isDefault ||
        a.name.toLowerCase().includes("(padrão)") ||
        a.name.toLowerCase().includes("(padrao)"),
    );
    if (defaultAddon) init.set(g.id, new Set([defaultAddon.id]));
  }
  return init;
}

function buildVariantSteps(variants: ProductVariant[]): VariantStep[] {
  if (variants.length === 0) return [];

  const byKey = new Map<string, ProductVariant[]>();
  for (const v of variants) {
    const key = (v.variantKey || "Variação").trim();
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(v);
  }

  return Array.from(byKey.entries()).map(([variantKey, group]) => ({
    kind: "variant" as const,
    id: `variant:${variantKey.toLowerCase().replace(/\s+/g, "_")}`,
    name: variantKey,
    isRequired: true as const,
    selectionType: "single" as const,
    variants: group,
  }));
}

export function useProductStepper(product: Product): ProductStepperState {
  const addonGroups = product.addonGroups ?? [];
  const variantSteps = useMemo(() => buildVariantSteps(product.variants ?? []), [product.variants]);
  const addonSteps: AddonStep[] = addonGroups.map((g) => ({
    kind: "addon",
    id: g.id,
    name: g.name,
    isRequired: g.isRequired,
    selectionType: g.selectionType,
    minSelections: g.minSelections,
    maxSelections: g.maxSelections,
    addons: g.addons,
  }));
  const steps: StepperStep[] = [...variantSteps, ...addonSteps];

  const [step, setStep] = useState(0);
  const [qty, setQty] = useState(1);
  const [variantSelections, setVariantSelections] = useState<Map<string, string>>(new Map());
  const [selections, setSelections] = useState<StepperSelections>(() => buildInitialAddonSelections(addonGroups));

  const currentStep = steps[step];

  function selectVariant(variantId: string) {
    if (!currentStep || currentStep.kind !== "variant") return;
    setVariantSelections((prev) => {
      const next = new Map(prev);
      next.set(currentStep.id, variantId);
      return next;
    });
  }

  function toggle(addonId: string) {
    if (!currentStep || currentStep.kind !== "addon") return;
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(currentStep.id) ?? []);

      if (currentStep.selectionType === "single") {
        next.set(currentStep.id, new Set([addonId]));
      } else {
        if (current.has(addonId)) {
          current.delete(addonId);
        } else {
          const max = currentStep.maxSelections;
          if (max > 0 && current.size >= max) return prev;
          current.add(addonId);
        }
        next.set(currentStep.id, current);
      }

      return next;
    });
  }

  function isStepValid(stepIndex: number): boolean {
    const s = steps[stepIndex];
    if (!s) return false;

    if (s.kind === "variant") {
      return Boolean(variantSelections.get(s.id));
    }

    if (!s.isRequired) return true;
    const selected = selections.get(s.id);
    const count = selected?.size ?? 0;
    const min = s.minSelections > 0 ? s.minSelections : 1;
    return count >= min;
  }

  const selectedIdsForStep: Set<string> =
    currentStep?.kind === "addon"
      ? selections.get(currentStep.id) ?? new Set()
      : new Set();

  const selectedVariantIdForStep =
    currentStep?.kind === "variant"
      ? variantSelections.get(currentStep.id) ?? null
      : null;

  const canAdvance = isStepValid(step);

  const selectedPrimaryVariant = variantSteps
    .map((s) => variantSelections.get(s.id))
    .filter(Boolean)
    .map((id) => product.variants.find((v) => v.id === id))
    .find(Boolean) ?? null;

  const baseCents = selectedPrimaryVariant?.priceCents ?? product.priceCents;

  const totalCents =
    baseCents +
    addonSteps.reduce((sum, g) => {
      const selectedIds = selections.get(g.id) ?? new Set();
      return (
        sum +
        g.addons
          .filter((a) => selectedIds.has(a.id))
          .reduce((s, a) => s + a.priceCents, 0)
      );
    }, 0);

  function buildSynthetic(): Product {
    const selectedVariants = variantSteps
      .map((s) => {
        const id = variantSelections.get(s.id);
        return s.variants.find((v) => v.id === id);
      })
      .filter((v): v is ProductVariant => Boolean(v));

    const selectedAddons: ProductAddon[] = [];
    for (const s of addonSteps) {
      const ids = selections.get(s.id) ?? new Set();
      selectedAddons.push(...s.addons.filter((a) => ids.has(a.id)));
    }

    const extraCents = selectedAddons.reduce((sum, a) => sum + a.priceCents, 0);
    const primaryVariant = selectedVariants[0] ?? null;
    const base = primaryVariant?.priceCents ?? product.priceCents;

    const nameParts = [
      product.name,
      ...selectedVariants.map((v) => v.variantValue),
      ...addonSteps
        .map((s) => {
          const ids = selections.get(s.id) ?? new Set();
          return s.addons
            .filter((a) => ids.has(a.id))
            .map((a) => a.name)
            .join(", ");
        })
        .filter(Boolean),
    ];

    const addonIds = addonSteps
      .flatMap((s) => [...(selections.get(s.id) ?? [])])
      .filter(Boolean);

    return {
      ...product,
      id: encodeSyntheticProductId(product.id, primaryVariant?.id, addonIds),
      name: nameParts.join(" · "),
      priceCents: base + extraCents,
    };
  }

  return {
    steps,
    step,
    qty,
    setQty,
    currentStep,
    isFirstStep: step === 0,
    isLastStep: step === steps.length - 1,
    selections,
    selectedIdsForStep,
    selectedVariantIdForStep,
    canAdvance,
    totalCents,
    goNext: () => setStep((s) => Math.min(s + 1, steps.length - 1)),
    goBack: () => setStep((s) => Math.max(s - 1, 0)),
    toggle,
    selectVariant,
    buildSynthetic,
  };
}
