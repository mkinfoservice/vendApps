import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ImagePlus, Trash2, Star, Plus } from "lucide-react";
import { fetchCategories } from "@/features/catalog/api";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import {
  useAdminProductById,
  useCreateProduct,
  useUpdateProduct,
  useUploadProductImage,
  useDeleteProductImage,
  useCreateProductAddon,
  useUpdateProductAddon,
  useDeleteProductAddon,
} from "@/features/admin/products/queries";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

// ── Tipos: Insumos vinculados ──────────────────────────────────────────────

type SupplyLink = {
  id: string;
  supplyId: string;
  supplyName: string;
  unit: string;
  quantityPerUnit: number;
};

type SupplyOption = {
  id: string;
  name: string;
  unit: string;
};

function resolveUrl(url: string) {
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function centsToReal(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function realToCents(value: string) {
  const clean = value.replace(/[^\d,]/g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

// ── Formulário ─────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  unit: string;
  priceStr: string;
  costStr: string;
  stockStr: string;
  barcode: string;
  internalCode: string;
  ncm: string;
  isActive: boolean;
  hasAddons: boolean;
  isSupply: boolean;
};

const EMPTY: FormState = {
  name:         "",
  slug:         "",
  categoryId:   "",
  description:  "",
  unit:         "UN",
  priceStr:     "0,00",
  costStr:      "0,00",
  stockStr:     "0",
  barcode:      "",
  internalCode: "",
  ncm:          "",
  isActive:     true,
  hasAddons:    false,
  isSupply:     false,
};

export default function ProductForm() {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isNew     = !id || id === "new";

  const [form, setForm]         = useState<FormState>(EMPTY);
  const [slugManual, setSlugManual] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);

  const productQuery  = useAdminProductById(isNew ? "" : id!);
  const createMut     = useCreateProduct();
  const updateMut     = useUpdateProduct(isNew ? "" : id!);
  const uploadImage   = useUploadProductImage(isNew ? "" : id!);
  const deleteImage   = useDeleteProductImage(isNew ? "" : id!);
  const createAddon   = useCreateProductAddon(isNew ? "" : id!);
  const updateAddon   = useUpdateProductAddon(isNew ? "" : id!);
  const deleteAddon   = useDeleteProductAddon(isNew ? "" : id!);

  const [newAddonName, setNewAddonName]   = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("0,00");

  // Estado: Insumos vinculados
  const [supplyLinks, setSupplyLinks]       = useState<SupplyLink[]>([]);
  const [supplyOptions, setSupplyOptions]   = useState<SupplyOption[]>([]);
  const [newLinkSupplyId, setNewLinkSupplyId] = useState("");
  const [newLinkQty, setNewLinkQty]           = useState("1");
  const [savingLink, setSavingLink]           = useState(false);

  // Carrega categorias (público, usa VITE_COMPANY_SLUG)
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Carrega insumos vinculados e lista de insumos disponíveis (modo edição)
  useEffect(() => {
    if (isNew || !id) return;
    adminFetch<SupplyLink[]>(`/admin/products/${id}/supply-links`)
      .then(setSupplyLinks)
      .catch(() => {});
    adminFetch<SupplyOption[]>("/admin/supplies?active=true")
      .then(setSupplyOptions)
      .catch(() => {});
  }, [isNew, id]);

  // Preenche form ao carregar produto (modo edição)
  useEffect(() => {
    if (!productQuery.data) return;
    const p = productQuery.data;
    setForm({
      name:         p.name,
      slug:         p.slug,
      categoryId:   p.categoryId,
      description:  p.description ?? "",
      unit:         p.unit,
      priceStr:     centsToReal(p.priceCents),
      costStr:      centsToReal(p.costCents),
      stockStr:     String(p.stockQty),
      barcode:      p.barcode ?? "",
      internalCode: p.internalCode ?? "",
      ncm:          p.ncm ?? "",
      isActive:     p.isActive,
      hasAddons:    p.hasAddons,
      isSupply:     p.isSupply,
    });
    setSlugManual(true); // em edição, slug não é auto-derivado
  }, [productQuery.data]);

  // Auto-slug quando name muda (apenas criação e sem edição manual)
  const nameRef = useRef(form.name);
  function handleNameChange(value: string) {
    setForm((f) => ({
      ...f,
      name: value,
      slug: !slugManual ? slugify(value) : f.slug,
    }));
    nameRef.current = value;
  }

  function set(field: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Margem calculada em tempo real
  const price  = realToCents(form.priceStr);
  const cost   = realToCents(form.costStr);
  const margin = price > 0 ? ((price - cost) / price * 100) : 0;

  async function handleAddSupplyLink() {
    if (!newLinkSupplyId || !id) return;
    const qty = parseFloat(newLinkQty.replace(",", "."));
    if (isNaN(qty) || qty <= 0) return;
    setSavingLink(true);
    try {
      const link = await adminFetch<SupplyLink>(`/admin/products/${id}/supply-links`, {
        method: "POST",
        body: JSON.stringify({ supplyId: newLinkSupplyId, quantityPerUnit: qty }),
      });
      setSupplyLinks((prev) => [...prev, link]);
      setNewLinkSupplyId("");
      setNewLinkQty("1");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao vincular insumo.");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleDeleteSupplyLink(linkId: string, supplyName: string) {
    if (!id || !confirm(`Remover vínculo com "${supplyName}"?`)) return;
    try {
      await adminFetch(`/admin/products/${id}/supply-links/${linkId}`, { method: "DELETE" });
      setSupplyLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {
      alert("Erro ao remover vínculo.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    if (!form.categoryId)  { setError("Categoria é obrigatória."); return; }

    const payload = {
      name:         form.name.trim(),
      slug:         form.slug.trim() || undefined,
      categoryId:   form.categoryId,
      description:  form.description.trim() || null,
      unit:         form.unit.trim() || "UN",
      priceCents:   realToCents(form.priceStr),
      costCents:    realToCents(form.costStr),
      stockQty:     parseFloat(form.stockStr.replace(",", ".")) || 0,
      barcode:      form.barcode.trim() || null,
      internalCode: form.internalCode.trim() || null,
      ncm:          form.ncm.trim() || null,
      isActive:     form.isActive,
      hasAddons:    form.hasAddons,
      isSupply:     form.isSupply,
    };

    try {
      if (isNew) {
        const res = await createMut.mutateAsync(payload);
        navigate(`/app/produtos/${res.id}`, { replace: true });
      } else {
        await updateMut.mutateAsync(payload);
        navigate("/app/produtos");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar produto.");
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;
  const isLoadingProduct = !isNew && productQuery.isLoading;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {isNew ? "Novo produto" : "Editar produto"}
            </h1>
            {!isNew && productQuery.data && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {productQuery.data.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/app/produtos")}
            className="rounded-xl border px-3 py-2 text-xs transition hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Voltar
          </button>
        </div>

        {isLoadingProduct && (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>Carregando produto...</div>
        )}

        {!isLoadingProduct && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados principais */}
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Dados principais</div>

              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Nome *</label>
                <input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Ração Premium para Cães"
                  required
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Slug <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(URL amigável)</span>
                </label>
                <input
                  value={form.slug}
                  onChange={(e) => { setSlugManual(true); set("slug", e.target.value); }}
                  placeholder="racao-premium-para-caes"
                  className="w-full h-10 rounded-xl border px-3.5 text-sm font-mono outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                />
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Categoria *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Descrição do produto..."
                  rows={3}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40 resize-none"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              {/* Unidade + Ativo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Unidade</label>
                  <select
                    value={form.unit}
                    onChange={(e) => set("unit", e.target.value)}
                    className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="KG">KG (Quilo)</option>
                    <option value="G">G (Grama)</option>
                    <option value="L">L (Litro)</option>
                    <option value="ML">ML (Mililitro)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="PC">PC (Peça)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Status</label>
                  <button
                    type="button"
                    onClick={() => set("isActive", !form.isActive)}
                    className="w-full h-10 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: form.isActive ? "rgba(74,222,128,0.1)" : "var(--surface-2)",
                      color: form.isActive ? "#4ade80" : "var(--text-muted)",
                    }}
                  >
                    {form.isActive ? "Ativo" : "Inativo"}
                  </button>
                </div>
              </div>
            </section>

            {/* Preço e estoque */}
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Preço e estoque</div>

              <div className="grid grid-cols-2 gap-3">
                {/* Preço de venda */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Preço de venda (R$)</label>
                  <input
                    value={form.priceStr}
                    onChange={(e) => set("priceStr", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                {/* Custo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Custo (R$)</label>
                  <input
                    value={form.costStr}
                    onChange={(e) => set("costStr", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              </div>

              {/* Margem calculada */}
              {price > 0 && (
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"
                  style={{ backgroundColor: "var(--surface-2)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Margem calculada</span>
                  <span
                    className="font-extrabold"
                    style={{ color: margin >= 30 ? "#4ade80" : margin >= 10 ? "#facc15" : "#f87171" }}
                  >
                    {margin.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Estoque */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Estoque</label>
                <input
                  value={form.stockStr}
                  onChange={(e) => set("stockStr", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            </section>

            {/* Dados adicionais */}
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Dados adicionais</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Código interno</label>
                  <input
                    value={form.internalCode}
                    onChange={(e) => set("internalCode", e.target.value)}
                    placeholder="SKU-001"
                    className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Código de barras</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="7891234567890"
                    className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>NCM</label>
                <input
                  value={form.ncm}
                  onChange={(e) => set("ncm", e.target.value)}
                  placeholder="Ex: 2309.10.00"
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            </section>

            {/* Flags: Adicionais / Insumo */}
            <section
              className="rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Comportamento</div>
              <div className="grid grid-cols-2 gap-3">
                {/* Tem adicionais */}
                <button
                  type="button"
                  onClick={() => set("hasAddons", !form.hasAddons)}
                  className="h-10 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: form.hasAddons ? "rgba(124,92,248,0.12)" : "var(--surface-2)",
                    color: form.hasAddons ? "#7c5cf8" : "var(--text-muted)",
                  }}
                >
                  {form.hasAddons ? "✓ Tem adicionais" : "Tem adicionais"}
                </button>
                {/* É insumo */}
                <button
                  type="button"
                  onClick={() => set("isSupply", !form.isSupply)}
                  className="h-10 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: form.isSupply ? "rgba(250,204,21,0.12)" : "var(--surface-2)",
                    color: form.isSupply ? "#eab308" : "var(--text-muted)",
                  }}
                >
                  {form.isSupply ? "✓ É insumo" : "É insumo"}
                </button>
              </div>
            </section>

            {/* Adicionais — só em edição e quando hasAddons */}
            {!isNew && form.hasAddons && (
              <section
                className="rounded-2xl border p-5 space-y-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Adicionais</div>

                {/* Lista de addons existentes */}
                {(productQuery.data?.addons ?? []).length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum adicional cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {productQuery.data?.addons.map((addon) => (
                      <div
                        key={addon.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                        style={{ backgroundColor: "var(--surface-2)" }}
                      >
                        <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>{addon.name}</span>
                        <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                          +R$ {centsToReal(addon.priceCents)}
                        </span>
                        <button
                          type="button"
                          title={addon.isActive ? "Desativar" : "Ativar"}
                          onClick={() => updateAddon.mutate({ addonId: addon.id, data: { isActive: !addon.isActive } })}
                          className="text-xs px-2 py-1 rounded-lg transition-all"
                          style={{
                            backgroundColor: addon.isActive ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                            color: addon.isActive ? "#4ade80" : "#f87171",
                          }}
                        >
                          {addon.isActive ? "Ativo" : "Inativo"}
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => {
                            if (!confirm(`Excluir adicional "${addon.name}"?`)) return;
                            deleteAddon.mutate(addon.id);
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-red-950/40"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Novo adicional */}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newAddonName}
                    onChange={(e) => setNewAddonName(e.target.value)}
                    placeholder="Nome do adicional"
                    className="flex-1 h-9 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                  <input
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="w-24 h-9 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                  <button
                    type="button"
                    disabled={!newAddonName.trim() || createAddon.isPending}
                    onClick={() => {
                      if (!newAddonName.trim()) return;
                      createAddon.mutate(
                        { name: newAddonName.trim(), priceCents: realToCents(newAddonPrice) },
                        { onSuccess: () => { setNewAddonName(""); setNewAddonPrice("0,00"); } }
                      );
                    }}
                    className="h-9 px-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
                    style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </section>
            )}

            {/* Insumos vinculados — só disponível em edição */}
            {!isNew && (
              <section
                className="rounded-2xl border p-5 space-y-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div>
                  <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Insumos consumidos</div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Ao vender este produto, o estoque dos insumos abaixo será debitado automaticamente.
                  </p>
                </div>

                {/* Lista de vínculos existentes */}
                {supplyLinks.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum insumo vinculado.</p>
                ) : (
                  <div className="space-y-2">
                    {supplyLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                        style={{ backgroundColor: "var(--surface-2)" }}
                      >
                        <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>{link.supplyName}</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {link.quantityPerUnit} {link.unit} / venda
                        </span>
                        <button
                          type="button"
                          title="Remover vínculo"
                          onClick={() => handleDeleteSupplyLink(link.id, link.supplyName)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-red-950/40"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar novo vínculo */}
                <div className="flex gap-2 pt-1">
                  <select
                    value={newLinkSupplyId}
                    onChange={(e) => setNewLinkSupplyId(e.target.value)}
                    className="flex-1 h-9 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <option value="">Selecione um insumo</option>
                    {supplyOptions
                      .filter((s) => !supplyLinks.some((l) => l.supplyId === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                      ))}
                  </select>
                  <input
                    value={newLinkQty}
                    onChange={(e) => setNewLinkQty(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Qtd"
                    className="w-20 h-9 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                  <button
                    type="button"
                    disabled={!newLinkSupplyId || savingLink}
                    onClick={handleAddSupplyLink}
                    className="h-9 px-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
                    style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                  >
                    <Plus size={14} />
                    Vincular
                  </button>
                </div>
              </section>
            )}

            {/* Imagens — só disponível em edição (precisa do ID) */}
            {!isNew && (
              <section
                className="rounded-2xl border p-5 space-y-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Imagens</div>
                  <label
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                  >
                    <ImagePlus size={14} />
                    {uploadImage.isPending ? "Enviando..." : "Adicionar imagem"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadImage.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        uploadImage.mutate(file, {
                          onError: (err) => alert(err instanceof Error ? err.message : "Erro ao enviar imagem."),
                        });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {/* Grid de imagens */}
                {(productQuery.data?.images.length ?? 0) === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Nenhuma imagem cadastrada. Adicione uma imagem acima.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {productQuery.data?.images.map((img) => (
                      <div key={img.id} className="relative group rounded-2xl overflow-hidden aspect-square" style={{ backgroundColor: "var(--surface-2)" }}>
                        <img
                          src={resolveUrl(img.url)}
                          alt="Imagem do produto"
                          className="w-full h-full object-cover"
                        />
                        {/* Badge principal */}
                        {img.isPrimary && (
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: "#7c5cf8" }}>
                            <Star size={9} />
                            Principal
                          </div>
                        )}
                        {/* Botão excluir */}
                        <button
                          type="button"
                          title="Excluir imagem"
                          disabled={deleteImage.isPending}
                          onClick={() => {
                            if (!confirm("Excluir esta imagem?")) return;
                            deleteImage.mutate(img.id, {
                              onError: (err) => alert(err instanceof Error ? err.message : "Erro ao excluir imagem."),
                            });
                          }}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                        >
                          <Trash2 size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadImage.isError && (
                  <p className="text-xs text-red-400">
                    {uploadImage.error instanceof Error ? uploadImage.error.message : "Erro ao enviar imagem."}
                  </p>
                )}
              </section>
            )}

            {/* Erro */}
            {error && (
              <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate("/app/produtos")}
                className="flex-1 h-11 rounded-2xl border text-sm font-semibold transition-all hover:bg-[var(--surface)]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
              >
                {isSaving ? "Salvando..." : isNew ? "Criar produto" : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
