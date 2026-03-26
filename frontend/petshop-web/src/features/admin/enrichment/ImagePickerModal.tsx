import { useState } from "react";
import { X, Search, Loader2, Image, CheckCircle2 } from "lucide-react";
import { searchImages, setProductImage, type MlImageResult } from "./imageSearchApi";

type Props = {
  productId: string;
  productName: string;
  onClose: () => void;
  onApplied: () => void;
};

export function ImagePickerModal({ productId, productName, onClose, onApplied }: Props) {
  const [query, setQuery] = useState(productName);
  const [results, setResults] = useState<MlImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const data = await searchImages(query.trim());
      setResults(data);
      if (data.length === 0) setError("Nenhuma imagem encontrada. Tente outros termos.");
    } catch {
      setError("Erro ao buscar imagens. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(url: string) {
    setApplying(url);
    try {
      await setProductImage(productId, url);
      setApplied(url);
      setTimeout(() => { onApplied(); onClose(); }, 800);
    } catch {
      setError("Erro ao aplicar imagem.");
    } finally {
      setApplying(null);
    }
  }

  // Todas as fotos de todos os resultados, em ordem
  const allPictures = results.flatMap((r) =>
    r.pictures.map((url) => ({ url, title: r.title }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 text-base">Buscar Imagem</p>
            <p className="text-xs text-gray-400 truncate">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nome do produto ou marca..."
              className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] outline-none"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="h-10 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "var(--brand)" }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Fonte: Mercado Livre · clique em uma imagem para aplicar ao produto
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="text-sm text-center text-gray-400 py-8">{error}</p>
          )}

          {!loading && !error && allPictures.length === 0 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-300">
              <Image className="w-12 h-12" />
              <p className="text-sm text-gray-400">Digite um nome e clique em Buscar</p>
            </div>
          )}

          {allPictures.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {allPictures.map(({ url, title }, i) => {
                const isApplied = applied === url;
                const isApplying = applying === url;
                return (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => handleApply(url)}
                    disabled={!!applying || !!applied}
                    title={title}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed group"
                    style={{ borderColor: isApplied ? "var(--brand)" : "transparent" }}
                  >
                    <img
                      src={url}
                      alt={title}
                      className="w-full h-full object-contain bg-gray-50 p-1"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).closest("button")?.remove();
                      }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                      {isApplying && (
                        <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow" />
                      )}
                      {isApplied && (
                        <CheckCircle2 className="w-8 h-8 text-white drop-shadow" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer count */}
        {allPictures.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 text-center">
              {allPictures.length} imagem{allPictures.length !== 1 ? "ns" : ""} de {results.length} produto{results.length !== 1 ? "s" : ""} no Mercado Livre
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
