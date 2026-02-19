const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

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
  imageUrl: string;
  categoryId: Category;
  
};

export async function fetchCategories() {
  const r = await fetch(`${API_URL}/catalog/categories`);
  if (!r.ok) throw new Error("Erro ao buscar categorias");
  return r.json();
}

export async function fetchProducts(categorySlug?: string, search?: string) {
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (search) params.set("search", search);

  const qs = params.toString();
  const r = await fetch(`${API_URL}/catalog/products${qs ? `?${qs}` : ""}`);

  if (!r.ok) throw new Error("Erro ao buscar produtos");
  return r.json();
}
