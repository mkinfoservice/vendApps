import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPromotions, createPromotion, updatePromotion,
  togglePromotion, deletePromotion,
  type PromotionDto, type PromotionType, type PromotionScope,
} from "@/features/promotions/promotionsApi";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Tag, Plus, Pencil, Power, Trash2, Search } from "lucide-react";

const INPUT = "bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";

// ── Catalog lookup types ──────────────────────────────────────────────────────

interface NamedItem { id: string; name: string; }

function useCatalogItems(scope: PromotionScope) {
  const isCategory = scope === "Category";
  const isBrand    = scope === "Brand";

  const cats = useQuery<NamedItem[]>({
    queryKey: ["admin-categories"],
    queryFn: () => adminFetch<NamedItem[]>("/admin/catalog/categories"),
    enabled: isCategory,
  });

  const brands = useQuery<NamedItem[]>({
    queryKey: ["admin-brands"],
    queryFn: () => adminFetch<NamedItem[]>("/admin/catalog/brands"),
    enabled: isBrand,
  });

  if (isCategory) return cats.data ?? [];
  if (isBrand)    return brands.data ?? [];
  return [];
}

function useProductSearch(query: string) {
  return useQuery<{ items: { id: string; name: string; barcode: string | null }[] }>({
    queryKey: ["product-search", query],
    queryFn: () =>
      adminFetch<{ items: { id: string; name: string; barcode: string | null }[] }>(
        `/admin/products?search=${encodeURIComponent(query)}&pageSize=8&active=true`
      ),
    enabled: query.length >= 2,
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS = {
  active:    "bg-green-100 text-green-700",
  expired:   "bg-red-100 text-red-600",
  scheduled: "bg-blue-100 text-blue-700",
};
const STATUS_LABEL = { active: "Ativa", expired: "Expirada", scheduled: "Agendada" };

function fmtValue(p: PromotionDto) {
  return p.type === "PercentDiscount"
    ? `${p.value}% OFF`
    : `R$${(p.value / 100).toFixed(2)} OFF`;
}

function fmtScope(p: PromotionDto) {
  const base = { All: "Toda a compra", Category: "Categoria", Brand: "Marca", Product: "Produto" }[p.scope] ?? p.scope;
  return p.targetName ? `${base}: ${p.targetName}` : base;
}

// ── Promotion form modal ──────────────────────────────────────────────────────

const EMPTY: Omit<PromotionDto, "id" | "createdAtUtc" | "status"> = {
  name: "", description: null, isActive: true,
  type: "PercentDiscount", scope: "All",
  targetId: null, targetName: null,
  value: 10, couponCode: null,
  minOrderCents: null, maxDiscountCents: null,
  startsAtUtc: null, expiresAtUtc: null,
};

function PromotionModal({
  promo,
  onClose,
}: { promo: PromotionDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = promo === null;

  const [form, setForm] = useState<Omit<PromotionDto, "id" | "createdAtUtc" | "status">>(
    promo
      ? { name: promo.name, description: promo.description, isActive: promo.isActive,
          type: promo.type, scope: promo.scope, targetId: promo.targetId,
          targetName: promo.targetName, value: promo.value, couponCode: promo.couponCode,
          minOrderCents: promo.minOrderCents, maxDiscountCents: promo.maxDiscountCents,
          startsAtUtc: promo.startsAtUtc, expiresAtUtc: promo.expiresAtUtc }
      : { ...EMPTY }
  );

  const [productSearch, setProductSearch] = useState(promo?.targetName ?? "");
  const [couponInput, setCouponInput] = useState(promo?.couponCode ?? "");
  const [error, setError] = useState<string | null>(null);

  const scopeItems = useCatalogItems(form.scope);
  const { data: prodResults } = useProductSearch(form.scope === "Product" ? productSearch : "");

  const mut = useMutation({
    mutationFn: () =>
      isNew ? createPromotion(form) : updatePromotion(promo!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["promotions"] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function sanitizeCouponCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
  }

  // Reset target when scope changes
  function changeScope(s: PromotionScope) {
    setForm(p => ({ ...p, scope: s, targetId: null, targetName: null }));
    setProductSearch("");
  }

  const isValid = form.name.trim().length >= 2 && form.value > 0 &&
    (form.scope === "All" || form.targetId !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-auto">
        <h2 className="font-semibold text-gray-900">{isNew ? "Nova promoção" : "Editar promoção"}</h2>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nome *</label>
            <input className={`mt-1 ${INPUT}`} value={form.name}
              onChange={e => set("name", e.target.value)} />
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</label>
              <select className={`mt-1 ${INPUT}`} value={form.type}
                onChange={e => set("type", e.target.value as PromotionType)}>
                <option value="PercentDiscount">Percentual (%)</option>
                <option value="FixedAmount">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {form.type === "PercentDiscount" ? "Desconto (%)" : "Desconto (R$)"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`mt-1 ${INPUT}`}
                value={form.type === "PercentDiscount" ? String(form.value) : (form.value / 100).toFixed(2)}
                onChange={e => {
                  const parsed = parseFloat(e.target.value);
                  if (!Number.isFinite(parsed)) {
                    set("value", 0);
                    return;
                  }
                  if (form.type === "PercentDiscount") {
                    set("value", parsed);
                  } else {
                    set("value", Math.round(parsed * 100));
                  }
                }}
              />
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aplicar a</label>
            <select className={`mt-1 ${INPUT}`} value={form.scope}
              onChange={e => changeScope(e.target.value as PromotionScope)}>
              <option value="All">Toda a compra</option>
              <option value="Category">Categoria específica</option>
              <option value="Brand">Marca específica</option>
              <option value="Product">Produto específico</option>
            </select>
          </div>

          {/* Target selector */}
          {(form.scope === "Category" || form.scope === "Brand") && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {form.scope === "Category" ? "Categoria" : "Marca"} *
              </label>
              <select className={`mt-1 ${INPUT}`}
                value={form.targetId ?? ""}
                onChange={e => {
                  const item = scopeItems.find(x => x.id === e.target.value);
                  set("targetId", e.target.value || null);
                  set("targetName", item?.name ?? null);
                }}>
                <option value="">Selecione...</option>
                {scopeItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.scope === "Product" && (
            <div className="relative">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Produto *</label>
              <input className={`mt-1 ${INPUT}`} placeholder="Buscar produto..."
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); set("targetId", null); set("targetName", null); }} />
              {form.targetId && (
                <p className="text-xs text-brand mt-0.5 flex items-center gap-1">
                  ✓ {form.targetName}
                </p>
              )}
              {prodResults?.items && prodResults.items.length > 0 && !form.targetId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {prodResults.items.map(p => (
                    <button key={p.id} type="button"
                      onMouseDown={() => {
                        set("targetId", p.id);
                        set("targetName", p.name);
                        setProductSearch(p.name);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Coupon code */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Código de cupom <span className="normal-case text-gray-400">(vazio = automático)</span>
            </label>
            <input
              className={`mt-1 ${INPUT} uppercase`}
              value={couponInput}
              placeholder="ex: VERAO20"
              onChange={e => {
                const code = sanitizeCouponCode(e.target.value);
                setCouponInput(code);
                set("couponCode", code || null);
              }}
            />
            <p className="text-[11px] mt-1 text-gray-400">Padrão: 4-24 chars (A-Z, 0-9, "_" ou "-").</p>
          </div>

          {/* Min order / max discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Pedido mínimo (R$)
              </label>
              <input type="number" min="0" step="1" className={`mt-1 ${INPUT}`}
                value={form.minOrderCents !== null ? form.minOrderCents / 100 : ""}
                placeholder="Sem mínimo"
                onChange={e => set("minOrderCents", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)} />
            </div>
            {form.type === "PercentDiscount" && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Teto do desconto (R$)
                </label>
                <input type="number" min="0" step="1" className={`mt-1 ${INPUT}`}
                  value={form.maxDiscountCents !== null ? form.maxDiscountCents / 100 : ""}
                  placeholder="Sem teto"
                  onChange={e => set("maxDiscountCents", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)} />
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Início</label>
              <input type="datetime-local" className={`mt-1 ${INPUT}`}
                value={form.startsAtUtc ? form.startsAtUtc.slice(0, 16) : ""}
                onChange={e => set("startsAtUtc", e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expiração</label>
              <input type="datetime-local" className={`mt-1 ${INPUT}`}
                value={form.expiresAtUtc ? form.expiresAtUtc.slice(0, 16) : ""}
                onChange={e => set("expiresAtUtc", e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Descrição <span className="normal-case text-gray-400">(opcional)</span>
            </label>
            <textarea className={`mt-1 ${INPUT} resize-none`} rows={2}
              value={form.description ?? ""}
              onChange={e => set("description", e.target.value || null)} />
          </div>

          {/* Active */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={e => set("isActive", e.target.checked)} />
            <span className="text-sm text-gray-700">Ativar imediatamente</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button
            disabled={!isValid || mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editPromo, setEditPromo] = useState<PromotionDto | null | undefined>(undefined);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["promotions", filterActive],
    queryFn: () => listPromotions(filterActive),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => togglePromotion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePromotion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  });

  const filtered = promos.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.couponCode ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {editPromo !== undefined && (
        <PromotionModal
          promo={editPromo}
          onClose={() => setEditPromo(undefined)}
        />
      )}

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(124,92,248,0.12)" }}>
              <Tag className="w-5 h-5" style={{ color: "#7c5cf8" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Promoções & Cupons</h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{promos.length} cadastrada{promos.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={() => setEditPromo(null)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            Nova promoção
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            {([undefined, true, false] as const).map(v => (
              <button key={String(v)}
                onClick={() => setFilterActive(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterActive === v ? "text-white shadow-sm" : ""
                }`}
                style={filterActive === v ? { backgroundColor: "#7c5cf8" } : { color: "var(--text-muted)" }}>
                {v === undefined ? "Todas" : v ? "Ativas" : "Inativas"}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        {isLoading ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>Nenhuma promoção encontrada.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => (
              <div key={p.id}
                className={`rounded-2xl border overflow-hidden ${!p.isActive ? "opacity-60" : ""}`}
                style={{ backgroundColor: "var(--surface)", borderColor: p.status === "expired" ? "rgba(239,68,68,0.3)" : "var(--border)" }}
              >
                {/* Color bar */}
                <div className={`h-1 w-full ${
                  p.type === "PercentDiscount" ? "bg-gradient-to-r from-brand to-purple-400" : "bg-gradient-to-r from-green-500 to-emerald-400"
                }`} />

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: "var(--text)" }}>{p.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fmtScope(p)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-brand">{fmtValue(p)}</span>
                    {p.couponCode && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-mono font-semibold rounded-lg">
                        {p.couponCode}
                      </span>
                    )}
                  </div>

                  {p.minOrderCents && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Pedido mínimo: R${(p.minOrderCents / 100).toFixed(2)}
                    </p>
                  )}

                  {(p.startsAtUtc || p.expiresAtUtc) && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {p.startsAtUtc && `De ${new Date(p.startsAtUtc).toLocaleDateString("pt-BR")} `}
                      {p.expiresAtUtc && `até ${new Date(p.expiresAtUtc).toLocaleDateString("pt-BR")}`}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => setEditPromo(p)}
                      className="p-1.5 rounded-lg transition"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-2)"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""}
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleMut.mutate(p.id)}
                      className={`p-1.5 rounded-lg transition ${
                        p.isActive
                          ? "hover:bg-orange-50 text-orange-400"
                          : "hover:bg-green-50 text-green-500"
                      }`}
                      title={p.isActive ? "Desativar" : "Ativar"}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir "${p.name}"?`))
                          deleteMut.mutate(p.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
