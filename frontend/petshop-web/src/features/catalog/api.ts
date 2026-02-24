const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

// Detecta o slug da empresa pelo subdomínio em runtime.
// Ex: suaempresa.vendapps.com.br → "suaempresa"
// Fallback: env var VITE_COMPANY_SLUG ou "petshop-demo"
function resolveCompanySlug(): string {
  const parts = window.location.hostname.split(".");
  if (parts.length >= 4 && (parts[1] === "vendapps" || parts[1] === "vandapps")) {
    return parts[0];
  }
  return import.meta.env.VITE_COMPANY_SLUG ?? "petshop-demo";
}

const COMPANY_SLUG = resolveCompanySlug();

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
  const r = await fetch(`${API_URL}/catalog/${COMPANY_SLUG}/categories`);
  if (!r.ok) throw new Error("Erro ao buscar categorias");
  return r.json();
}

export async function fetchProducts(categorySlug?: string, search?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (categorySlug) params.set("categorySlug", categorySlug);
  if (search) params.set("search", search);

  const qs = params.toString();
  const r = await fetch(`${API_URL}/catalog/${COMPANY_SLUG}/products${qs ? `?${qs}` : ""}`);

  if (!r.ok) throw new Error("Erro ao buscar produtos");
  return r.json();
}
