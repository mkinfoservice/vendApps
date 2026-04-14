import { resolveTenantFromHost } from "@/utils/tenant";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

// Frontend (Vercel) e backend (Render) estão em domínios distintos:
// o Host header da request sempre chega como "vendapps.onrender.com".
// Por isso usamos sempre slug explícito na URL do catálogo.
//   Subdomínio válido → slug extraído do hostname do browser
//   localhost / apex  → VITE_COMPANY_SLUG ou "petshop-demo"
const activeSlug =
  resolveTenantFromHost() ?? (import.meta.env.VITE_COMPANY_SLUG ?? "petshop-demo");

const catalogBase = `${API_URL}/catalog/${activeSlug}`;

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type ProductVariant = {
  id: string;
  variantKey: string;
  variantValue: string;
  priceCents: number | null;
};

export type ProductAddon = {
  id: string;
  name: string;
  priceCents: number;
  addonGroupId?: string | null;
  isDefault?: boolean;
};

export type ProductAddonGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  /** "single" = radio; "multiple" = checkbox */
  selectionType: "single" | "multiple";
  minSelections: number;
  /** 0 = sem limite */
  maxSelections: number;
  sortOrder: number;
  addons: ProductAddon[];
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  description: string | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  discountPercent: number | null;
  category: { id: string; name: string; slug: string };
  variants: ProductVariant[];
  addons: ProductAddon[];
  addonGroups: ProductAddonGroup[];
};

export async function fetchCategories(): Promise<Category[]> {
  const r = await fetch(`${catalogBase}/categories`);
  if (!r.ok) throw new Error("Erro ao buscar categorias");
  return r.json();
}

/**
 * Quando um produto tem adicionais (flat) mas nenhum grupo configurado,
 * cria um grupo sintético "Adicionais" para ativar a UI step-by-step.
 * Produtos sem adicionais não são afetados.
 */
/** Palavra-chave para classificar adicionais no mesmo esquema do backend AddonGroupSeeder. */
function classifyAddon(name: string, priceCents: number): { group: string; sort: number } {
  const n = name.toLowerCase();
  if (n.includes("leite") || n.includes("lactose") || n.includes("aveia") ||
      n.includes("integral") || n.includes("desnatat") || n.includes("soja") || n.includes("coco"))
    return { group: "Tipo de Leite", sort: 1 };
  if (n.includes("cobertura") || n.includes("chantilly") || n.includes("ganache") || n.includes("calda"))
    return { group: "Cobertura", sort: 2 };
  if (priceCents === 0)
    return { group: "Sabor", sort: 0 };
  return { group: "Extras", sort: 3 };
}

function normalizeProductGroups(p: Product): Product {
  if (p.addonGroups.length > 0 || p.addons.length === 0) return p;

  // Agrupa adicionais flat pelas mesmas regras do AddonGroupSeeder (backend)
  const buckets = new Map<string, { sort: number; addons: ProductAddon[] }>();
  for (const a of p.addons) {
    const { group, sort } = classifyAddon(a.name, a.priceCents);
    if (!buckets.has(group)) buckets.set(group, { sort, addons: [] });
    buckets.get(group)!.addons.push(a);
  }

  const syntheticGroups: ProductAddonGroup[] = [];
  for (const [groupName, { sort, addons }] of [...buckets.entries()].sort((a, b) => a[1].sort - b[1].sort)) {
    const syntheticId = `${p.id}__${groupName.replace(/\s+/g, "_").toLowerCase()}`;

    // Tipo de Leite: coloca "integral"/"padrão" primeiro e marca como isDefault
    let orderedAddons = addons;
    if (groupName === "Tipo de Leite") {
      orderedAddons = [...addons].sort((a) =>
        (a.name.toLowerCase().includes("integral") || a.name.toLowerCase().includes("(padrão)")) ? -1 : 1
      );
      orderedAddons = orderedAddons.map((a, i) => ({ ...a, isDefault: i === 0, addonGroupId: syntheticId }));
    } else {
      orderedAddons = addons.map((a) => ({ ...a, addonGroupId: syntheticId }));
    }

    syntheticGroups.push({
      id: syntheticId,
      name: groupName,
      isRequired: false,
      selectionType: groupName === "Extras" ? "multiple" : "single",
      minSelections: 0,
      maxSelections: groupName === "Extras" ? 0 : 1,
      sortOrder: sort,
      addons: orderedAddons,
    });
  }

  // Fallback: se todos os adicionais têm preço > 0 e nenhum match específico, usa grupo único
  if (syntheticGroups.length === 0) {
    const id = `${p.id}__default`;
    syntheticGroups.push({
      id, name: "Adicionais", isRequired: false, selectionType: "multiple",
      minSelections: 0, maxSelections: 0, sortOrder: 0,
      addons: p.addons.map((a) => ({ ...a, addonGroupId: id })),
    });
  }

  return { ...p, addonGroups: syntheticGroups };
}

export async function fetchProducts(categorySlug?: string, search?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (categorySlug) params.set("categorySlug", categorySlug);
  if (search) params.set("search", search);

  const qs = params.toString();
  const r = await fetch(`${catalogBase}/products${qs ? `?${qs}` : ""}`);

  if (!r.ok) throw new Error("Erro ao buscar produtos");
  const products: Product[] = await r.json();
  return products.map(normalizeProductGroups);
}

// ── StoreFront (banner + cor primária) ────────────────────────────────────────

export type BannerSlide = {
  id: string;
  imageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  ctaType: "none" | "category" | "product" | "external";
  ctaTarget: string | null;
  ctaNewTab: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type StoreFrontConfig = {
  id: string;
  companyId: string;
  primaryColor: string;
  bannerIntervalSecs: number;
  logoUrl: string | null;
  storeName: string | null;
  storeSlogan: string | null;
  announcements: string[];
  slides: BannerSlide[];
};

export async function fetchStoreFront(): Promise<StoreFrontConfig> {
  const r = await fetch(`${catalogBase}/storefront`);
  if (!r.ok) throw new Error("Erro ao buscar configuração da loja");
  return r.json();
}
