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
function normalizeProductGroups(p: Product): Product {
  if (p.addonGroups.length > 0 || p.addons.length === 0) return p;
  const syntheticId = `${p.id}__default`;
  return {
    ...p,
    addonGroups: [{
      id: syntheticId,
      name: "Adicionais",
      isRequired: false,
      selectionType: "multiple",
      minSelections: 0,
      maxSelections: 0,
      sortOrder: 0,
      addons: p.addons.map((a) => ({ ...a, addonGroupId: syntheticId })),
    }],
  };
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
