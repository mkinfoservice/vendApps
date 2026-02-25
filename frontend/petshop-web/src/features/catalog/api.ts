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
