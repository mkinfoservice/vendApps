import { adminFetch } from "@/features/admin/auth/adminFetch";

export type MlImageResult = {
  itemId: string;
  title: string;
  pictures: string[];
};

// ── Tipos da API pública do Mercado Livre ─────────────────────────────────────

type MlSearchResponse = {
  results: Array<{ id: string; title: string; thumbnail: string }>;
};

type MlItemBatchEntry = {
  code: number;
  body: {
    id: string;
    title: string;
    pictures: Array<{ secure_url?: string; url?: string }>;
  } | null;
};

/** Busca imagens diretamente na API pública do ML (sem passar pelo backend) */
export async function searchImages(q: string): Promise<MlImageResult[]> {
  const encoded = encodeURIComponent(q.trim());

  // 1. Busca itens
  const searchRes = await fetch(
    `https://api.mercadolibre.com/sites/MLB/search?q=${encoded}&limit=5`
  );
  if (!searchRes.ok) return [];

  const search: MlSearchResponse = await searchRes.json();
  if (!search.results?.length) return [];

  // 2. Busca detalhes em batch (retorna [{code, body},...])
  const ids = search.results.map((r) => r.id).join(",");
  const itemsRes = await fetch(`https://api.mercadolibre.com/items?ids=${ids}`);

  if (itemsRes.ok) {
    const entries: MlItemBatchEntry[] = await itemsRes.json();
    const results: MlImageResult[] = [];

    for (const entry of entries) {
      if (entry.code !== 200 || !entry.body?.pictures?.length) continue;
      const pictures = entry.body.pictures
        .map((p) => p.secure_url || p.url || "")
        .filter(Boolean);
      if (pictures.length === 0) continue;
      results.push({ itemId: entry.body.id, title: entry.body.title, pictures });
    }

    if (results.length > 0) return results;
  }

  // Fallback: usa thumbnails upscalados da busca (quando batch falha)
  return search.results
    .filter((r) => r.thumbnail)
    .map((r) => ({
      itemId: r.id,
      title: r.title,
      pictures: [r.thumbnail.replace(/-I\./g, "-F.").replace(/-O\./g, "-F.")],
    }));
}

export async function setProductImage(productId: string, url: string): Promise<void> {
  await adminFetch<unknown>(`/admin/enrichment/products/${productId}/image`, {
    method: "PUT",
    body: JSON.stringify({ url }),
  });
}
