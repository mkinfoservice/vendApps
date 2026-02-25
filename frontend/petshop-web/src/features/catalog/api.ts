import { resolveTenantFromHost } from "@/utils/tenant";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

// Slug do tenant resolvido pelo Host header (null em localhost / domínio apex)
const tenantSlug = resolveTenantFromHost();

// Fallback: env var VITE_COMPANY_SLUG ou "petshop-demo" (usado em dev/preview)
const fallbackSlug = import.meta.env.VITE_COMPANY_SLUG ?? "petshop-demo";

// Base da URL do catálogo:
//   Em subdomínio válido → /catalog           (Host resolvido pelo backend)
//   Em localhost / apex  → /catalog/{slug}    (slug explícito na URL)
const catalogBase = tenantSlug
  ? `${API_URL}/catalog`
  : `${API_URL}/catalog/${fallbackSlug}`;

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  category: { id: string; name: string; slug: string };
};

export async function fetchCategories(): Promise<Category[]> {
  const r = await fetch(`${catalogBase}/categories`);
  if (!r.ok) throw new Error("Erro ao buscar categorias");
  return r.json();
}

export async function fetchProducts(categorySlug?: string, search?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (categorySlug) params.set("categorySlug", categorySlug);
  if (search) params.set("search", search);

  const qs = params.toString();
  const r = await fetch(`${catalogBase}/products${qs ? `?${qs}` : ""}`);

  if (!r.ok) throw new Error("Erro ao buscar produtos");
  return r.json();
}
