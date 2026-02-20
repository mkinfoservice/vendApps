const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";
const COMPANY_SLUG = import.meta.env.VITE_COMPANY_SLUG ?? "petshop-demo";

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
