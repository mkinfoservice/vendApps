import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { fetchAdminProducts, type ProductListItem } from "@/features/admin/products/api";

interface Props {
  onSelect: (product: ProductListItem) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function ProductSearchInput({ onSelect, placeholder = "Buscar produto (nome, cód. interno, barcode)…", autoFocus, disabled }: Props) {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<ProductListItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [focused, setFocused]       = useState(false);
  const inputRef                    = useRef<HTMLInputElement>(null);
  const containerRef                = useRef<HTMLDivElement>(null);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchAdminProducts({ search: val.trim(), pageSize: 8, active: true });
        setResults(res.items);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  }

  function handleSelect(product: ProductListItem) {
    onSelect(product);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 bg-white transition ${focused ? "ring-2 ring-[#7c5cf8]/30 border-[#7c5cf8]/60" : "border-gray-200"}`}>
        {loading ? (
          <Loader2 size={15} className="text-gray-400 animate-spin shrink-0" />
        ) : (
          <Search size={15} className="text-gray-400 shrink-0" />
        )}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          disabled={disabled}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); if (results.length) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400 disabled:opacity-50"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#7c5cf8]/5 text-left transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {[p.internalCode && `Cód: ${p.internalCode}`, p.barcode && `EAN: ${p.barcode}`].filter(Boolean).join(" · ") || "Sem código"}
                </p>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className="text-sm font-semibold text-[#7c5cf8]">{formatPrice(p.priceCents)}</p>
                <p className="text-xs text-gray-400">Estq: {p.stockQty} {p.unit}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
          Nenhum produto encontrado para "{query}".
        </div>
      )}
    </div>
  );
}
