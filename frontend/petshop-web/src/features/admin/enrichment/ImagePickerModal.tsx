import { useState, useEffect } from "react";
import { X, Loader2, Image, CheckCircle2, Link } from "lucide-react";
import { searchImagesByBarcode, setProductImage } from "./imageSearchApi";

type Props = {
  productId: string;
  productName: string;
  barcode?: string | null;
  onClose: () => void;
  onApplied: () => void;
};

export function ImagePickerModal({ productId, productName, barcode, onClose, onApplied }: Props) {
  const [cosmosImage, setCosmosImage] = useState<string | null>(null);
  const [cosmosTitle, setCosmosTitle] = useState<string>("");
  const [loadingCosmos, setLoadingCosmos] = useState(false);
  const [cosmosNotFound, setCosmosNotFound] = useState(false);

  const [manualUrl, setManualUrl] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  // Auto-fetch from Cosmos when barcode is available
  useEffect(() => {
    if (!barcode) return;
    setLoadingCosmos(true);
    searchImagesByBarcode(barcode)
      .then((results) => {
        if (results.length > 0 && results[0].pictures.length > 0) {
          setCosmosImage(results[0].pictures[0]);
          setCosmosTitle(results[0].title);
        } else {
          setCosmosNotFound(true);
        }
      })
      .catch(() => setCosmosNotFound(true))
      .finally(() => setLoadingCosmos(false));
  }, [barcode]);

  async function handleApply(url: string) {
    if (!url.trim()) return;
    setApplying(true);
    setError("");
    try {
      await setProductImage(productId, url.trim());
      setApplied(true);
      setTimeout(() => { onApplied(); onClose(); }, 800);
    } catch {
      setError("Erro ao aplicar imagem.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden">
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

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Cosmos section */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Cosmos · Busca por código de barras
            </p>

            {!barcode && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 bg-gray-50 rounded-xl">
                <Image className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-400 text-center">
                  Produto sem código de barras cadastrado
                </p>
              </div>
            )}

            {barcode && loadingCosmos && (
              <div className="flex items-center justify-center py-8 gap-2 bg-gray-50 rounded-xl">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-400">Buscando no Cosmos...</p>
              </div>
            )}

            {barcode && !loadingCosmos && cosmosNotFound && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 bg-gray-50 rounded-xl">
                <Image className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-400">Produto não encontrado no Cosmos</p>
                <p className="text-xs text-gray-400">EAN: {barcode}</p>
              </div>
            )}

            {barcode && !loadingCosmos && cosmosImage && (
              <button
                type="button"
                onClick={() => handleApply(cosmosImage)}
                disabled={applying || applied}
                title={cosmosTitle}
                className="relative w-full aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed block"
                style={{ borderColor: applied ? "var(--brand)" : "transparent" }}
              >
                <img
                  src={cosmosImage}
                  alt={cosmosTitle}
                  className="w-full h-full object-contain bg-gray-50 p-2"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center">
                  {applying && <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow" />}
                  {applied && <CheckCircle2 className="w-8 h-8 text-white drop-shadow" />}
                </div>
              </button>
            )}

            {barcode && cosmosImage && !applied && (
              <p className="text-[11px] text-gray-400 text-center mt-2">
                Clique na imagem para aplicar ao produto
              </p>
            )}
          </div>

          {/* Manual URL section */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Ou cole a URL da imagem
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:border-[var(--brand)]">
                <Link className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApply(manualUrl)}
                  placeholder="https://..."
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => handleApply(manualUrl)}
                disabled={applying || applied || !manualUrl.trim()}
                className="h-10 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ background: "var(--brand)" }}
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
