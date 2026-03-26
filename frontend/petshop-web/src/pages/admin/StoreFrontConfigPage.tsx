import { useState, useRef, useEffect } from "react";
import { Paintbrush, Image, Plus, Trash2, GripVertical, Upload, AlertCircle, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import {
  useStoreFrontConfig,
  useUpdateStoreFrontConfig,
  useAddSlide,
  useUpdateSlide,
  useDeleteSlide,
  useReorderSlides,
} from "@/features/admin/storefront/queries";
import type { BannerSlideResponse, UpsertBannerSlideRequest } from "@/features/admin/storefront/types";

// ── Dimensões recomendadas ────────────────────────────────────────────────────
const BANNER_HINT = "Recomendado: 1200 × 400px · JPG/PNG/WebP · máx 300KB";

// ── Tipos de CTA ──────────────────────────────────────────────────────────────
const CTA_TYPES = [
  { value: "none",     label: "Sem botão" },
  { value: "category", label: "Grupo de produtos" },
  { value: "product",  label: "Produto específico" },
  { value: "external", label: "URL externa" },
] as const;

function ctaLabel(type: string) {
  return CTA_TYPES.find((t) => t.value === type)?.label ?? "Sem botão";
}

// ── Hook: categorias da empresa (via endpoint admin) ──────────────────────────
function useAdminCategories() {
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  useEffect(() => {
    adminFetch<{ id: string; name: string; slug: string }[]>("/admin/storefront/categories")
      .then(setCats)
      .catch(() => {});
  }, []);
  return cats;
}

// ── Helpers: upload → base64 ──────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileSizeOk(dataUrl: string): boolean {
  // base64 length ÷ 1.333 ≈ bytes originais
  const bytes = (dataUrl.length * 3) / 4;
  return bytes < 400 * 1024; // 400 KB
}

// ── ImageInput: URL ou upload ─────────────────────────────────────────────────
function ImageInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sizeWarn, setSizeWarn] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSizeWarn(false);
    try {
      const b64 = await fileToBase64(file);
      if (!fileSizeOk(b64)) {
        setSizeWarn(true);
        setUploading(false);
        return;
      }
      onChange(b64);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const isBase64 = value.startsWith("data:");

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Preview */}
        <div className="w-20 h-14 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <Image className="w-5 h-5 text-gray-300" />
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          {/* URL ou base64 text */}
          <input
            value={isBase64 ? "(imagem carregada)" : value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={isBase64}
            placeholder="Cole uma URL (https://...)"
            className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none disabled:bg-gray-50"
          />

          {/* Botões */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Carregando..." : "Carregar arquivo"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(""); setSizeWarn(false); }}
                className="h-8 px-3 rounded-xl border border-red-100 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">{BANNER_HINT}</p>

      {sizeWarn && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Imagem muito grande (máx 300KB). Comprima em{" "}
          <a href="https://squoosh.app" target="_blank" rel="noopener noreferrer" className="underline">
            squoosh.app
          </a>{" "}
          ou{" "}
          <a href="https://tinypng.com" target="_blank" rel="noopener noreferrer" className="underline">
            tinypng.com
          </a>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

// ── SlideForm ─────────────────────────────────────────────────────────────────

interface SlideFormProps {
  initial?: Partial<UpsertBannerSlideRequest>;
  onSave: (data: UpsertBannerSlideRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

function SlideForm({ initial, onSave, onCancel, loading }: SlideFormProps) {
  const categories = useAdminCategories();

  const [form, setForm] = useState<UpsertBannerSlideRequest>({
    imageUrl:  initial?.imageUrl  ?? "",
    title:     initial?.title     ?? "",
    subtitle:  initial?.subtitle  ?? "",
    ctaText:   initial?.ctaText   ?? "",
    ctaType:   initial?.ctaType   ?? "none",
    ctaTarget: initial?.ctaTarget ?? "",
    ctaNewTab: initial?.ctaNewTab ?? false,
    isActive:  initial?.isActive  ?? true,
  });

  const set = (k: keyof UpsertBannerSlideRequest, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    onSave({
      ...form,
      imageUrl:  form.imageUrl  || null,
      title:     form.title     || null,
      subtitle:  form.subtitle  || null,
      ctaText:   form.ctaText   || null,
      ctaTarget: form.ctaTarget || null,
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gray-50 border border-gray-200">
      {/* Imagem */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">Imagem do banner</p>
        <ImageInput value={form.imageUrl ?? ""} onChange={(v) => set("imageUrl", v)} />
      </div>

      {/* Título e subtítulo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Título</span>
          <input
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex: Promoções Imperdíveis"
            maxLength={120}
            className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Subtítulo</span>
          <input
            value={form.subtitle ?? ""}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="Ex: Descontos em produtos selecionados"
            maxLength={200}
            className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
          />
        </label>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-600">Botão de ação (CTA)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Tipo de destino</span>
            <select
              value={form.ctaType}
              onChange={(e) => { set("ctaType", e.target.value); set("ctaTarget", ""); }}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
            >
              {CTA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {form.ctaType !== "none" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Texto do botão</span>
              <input
                value={form.ctaText ?? ""}
                onChange={(e) => set("ctaText", e.target.value)}
                placeholder='Ex: "Ver Ofertas"'
                maxLength={60}
                className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
              />
            </label>
          )}
        </div>

        {/* Destino específico por tipo */}
        {form.ctaType === "category" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Grupo de destino</span>
            <select
              value={form.ctaTarget ?? ""}
              onChange={(e) => set("ctaTarget", e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
            >
              <option value="">— Selecione um grupo —</option>
              <option value="">Todos os produtos</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        {form.ctaType === "product" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">ID do produto</span>
            <input
              value={form.ctaTarget ?? ""}
              onChange={(e) => set("ctaTarget", e.target.value)}
              placeholder="Copie o ID do produto em Produtos → Editar"
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm font-mono bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
            />
            <p className="text-[11px] text-gray-400">
              O ID está na URL ao editar um produto: /app/produtos/<strong>esse-id-aqui</strong>
            </p>
          </label>
        )}

        {form.ctaType === "external" && (
          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">URL de destino</span>
              <input
                value={form.ctaTarget ?? ""}
                onChange={(e) => set("ctaTarget", e.target.value)}
                placeholder="https://..."
                className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ctaNewTab ?? false}
                onChange={(e) => set("ctaNewTab", e.target.checked)}
                className="accent-[#7c5cf8]"
              />
              Abrir em nova aba
            </label>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive ?? true}
          onChange={(e) => set("isActive", e.target.checked)}
          className="accent-[#7c5cf8]"
        />
        Slide ativo (visível na loja)
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="h-9 px-5 rounded-xl text-sm font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
        >
          {loading ? "Salvando..." : "Salvar slide"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── SlideCard ─────────────────────────────────────────────────────────────────

function SlideCard({
  slide,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  slide: BannerSlideResponse;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border bg-white ${!slide.isActive ? "opacity-50" : ""}`}>
      <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
        {slide.imageUrl
          ? <img src={slide.imageUrl} alt={slide.title ?? ""} className="w-full h-full object-cover" />
          : <Image className="w-5 h-5 text-gray-300" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{slide.title || "(sem título)"}</p>
        <p className="text-xs text-gray-400 truncate">{slide.subtitle || ""}</p>
        {slide.ctaType !== "none" && (
          <span className="text-[10px] font-semibold text-[#7c5cf8] mt-0.5 inline-block">
            {ctaLabel(slide.ctaType)}{slide.ctaTarget ? `: ${slide.ctaTarget.slice(0, 30)}` : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={onMoveUp} disabled={index === 0}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"
          title="Mover para cima">
          <GripVertical className="w-3.5 h-3.5 text-gray-400 -rotate-90" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"
          title="Mover para baixo">
          <GripVertical className="w-3.5 h-3.5 text-gray-400 rotate-90" />
        </button>
        <button type="button" onClick={onEdit}
          className="h-7 px-3 rounded-lg text-xs font-semibold text-[#7c5cf8] hover:bg-purple-50 transition">
          Editar
        </button>
        <button type="button" onClick={onDelete}
          className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ActiveTab = "visual" | "banners";

export default function StoreFrontConfigPage() {
  const [tab, setTab] = useState<ActiveTab>("banners");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: config, isLoading } = useStoreFrontConfig();
  const updateConfig  = useUpdateStoreFrontConfig();
  const addSlide      = useAddSlide();
  const updateSlide   = useUpdateSlide();
  const deleteSlide   = useDeleteSlide();
  const reorderSlides = useReorderSlides();

  const [color, setColor]         = useState("#7c5cf8");
  const [intervalSecs, setIntervalSecs] = useState(5);
  const [logoUrl, setLogoUrl]     = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeSlogan, setStoreSlogan] = useState("");
  const [announcements, setAnnouncements] = useState<string[]>(["Frete Grátis acima de R$ 100"]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [visualSynced, setVisualSynced] = useState(false);

  useEffect(() => {
    if (config && !visualSynced) {
      setColor(config.primaryColor ?? "#7c5cf8");
      setIntervalSecs(config.bannerIntervalSecs ?? 5);
      setLogoUrl(config.logoUrl ?? "");
      setStoreName(config.storeName ?? "");
      setStoreSlogan(config.storeSlogan ?? "");
      setAnnouncements(config.announcements?.length ? config.announcements : ["Frete Grátis acima de R$ 100"]);
      setVisualSynced(true);
    }
  }, [config, visualSynced]);

  const addAnnouncement = () => {
    const msg = newAnnouncement.trim();
    if (!msg || announcements.includes(msg)) return;
    setAnnouncements((a) => [...a, msg]);
    setNewAnnouncement("");
  };

  const removeAnnouncement = (i: number) =>
    setAnnouncements((a) => a.filter((_, idx) => idx !== i));

  const handleSaveVisual = () => {
    updateConfig.mutate({
      primaryColor: color || "#7c5cf8",
      bannerIntervalSecs: intervalSecs,
      logoUrl:      logoUrl      || null,
      storeName:    storeName    || null,
      storeSlogan:  storeSlogan  || null,
      announcements: announcements.filter(Boolean),
    });
  };

  const moveSlide = (fromIdx: number, direction: "up" | "down") => {
    if (!config) return;
    const slides = [...config.slides];
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= slides.length) return;
    [slides[fromIdx], slides[toIdx]] = [slides[toIdx], slides[fromIdx]];
    reorderSlides.mutate(slides.map((s) => s.id));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16 space-y-6">
      <PageHeader
        title="Loja Online"
        subtitle="Banner rotativo, cores e identidade visual da sua loja"
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 w-fit">
        {(["banners", "visual"] as ActiveTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="h-9 px-5 rounded-xl text-sm font-semibold transition-all"
            style={
              tab === t
                ? { background: "linear-gradient(135deg,#7c5cf8,#6d4df2)", color: "white" }
                : { color: "var(--text-muted)" }
            }
          >
            {t === "banners" ? "Banners" : "Visual"}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-400">Carregando...</p>}

      {/* ── BANNERS ──────────────────────────────────────────────────────────── */}
      {tab === "banners" && config && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Slides do Banner</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {config.slides.length === 0
                  ? "Nenhum slide — exibindo banner padrão"
                  : `${config.slides.length} slide${config.slides.length !== 1 ? "s" : ""} configurado${config.slides.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="h-9 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 transition hover:brightness-110 active:scale-95"
                style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Novo slide
              </button>
            )}
          </div>

          {adding && (
            <SlideForm
              onSave={(data) => addSlide.mutate(data, { onSuccess: () => setAdding(false) })}
              onCancel={() => setAdding(false)}
              loading={addSlide.isPending}
            />
          )}

          <div className="space-y-2">
            {config.slides.map((slide, i) =>
              editingId === slide.id ? (
                <SlideForm
                  key={slide.id}
                  initial={slide}
                  onSave={(data) =>
                    updateSlide.mutate(
                      { id: slide.id, req: data },
                      { onSuccess: () => setEditingId(null) }
                    )
                  }
                  onCancel={() => setEditingId(null)}
                  loading={updateSlide.isPending}
                />
              ) : (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  index={i}
                  total={config.slides.length}
                  onEdit={() => { setEditingId(slide.id); setAdding(false); }}
                  onDelete={() => { if (confirm("Remover este slide?")) deleteSlide.mutate(slide.id); }}
                  onMoveUp={() => moveSlide(i, "up")}
                  onMoveDown={() => moveSlide(i, "down")}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* ── VISUAL ───────────────────────────────────────────────────────────── */}
      {tab === "visual" && config && (
        <div className="space-y-5">
          {/* Identidade da loja */}
          <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-[#7c5cf8]" />
              Identidade da Loja
            </h3>

            {/* Logo */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Logo da loja</p>
              <ImageInput value={logoUrl} onChange={setLogoUrl} />
            </div>

            {/* Nome e slogan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">Nome da loja</span>
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="PetShop Express"
                  maxLength={120}
                  className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">Slogan</span>
                <input
                  value={storeSlogan}
                  onChange={(e) => setStoreSlogan(e.target.value)}
                  placeholder="Delivery rápido"
                  maxLength={200}
                  className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
                />
              </label>
            </div>
          </div>

          {/* Faixa de avisos */}
          <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#7c5cf8]" />
              Faixa de Avisos
            </h3>
            <p className="text-xs text-gray-400 -mt-2">
              Mensagens que aparecem na faixa colorida do topo e rotacionam automaticamente.
            </p>

            {/* Lista de mensagens */}
            <div className="space-y-2">
              {announcements.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="flex-1 text-sm text-gray-800 truncate">{msg}</span>
                  <button
                    type="button"
                    onClick={() => removeAnnouncement(i)}
                    disabled={announcements.length <= 1}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition disabled:opacity-30"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar nova mensagem */}
            <div className="flex gap-2">
              <input
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAnnouncement()}
                placeholder='Ex: "Parcele em até 12x sem juros"'
                maxLength={100}
                className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
              />
              <button
                type="button"
                onClick={addAnnouncement}
                disabled={!newAnnouncement.trim()}
                className="h-10 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 transition hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>
          </div>

          {/* Cores e banner */}
          <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Cores e Banner</h3>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">Cor primária da marca</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#7c5cf8"
                  maxLength={10}
                  className="h-10 w-32 px-3 rounded-xl border border-gray-200 text-sm font-mono bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
                />
                <div
                  className="flex-1 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: color || "#7c5cf8" }}
                >
                  Preview
                </div>
              </div>
              <p className="text-xs text-gray-400">Barra do topo, badge e botão do carrinho.</p>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">Intervalo do banner (segundos)</span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={intervalSecs}
                  onChange={(e) => setIntervalSecs(Number(e.target.value))}
                  className="h-10 w-24 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
                />
                <span className="text-xs text-gray-400">0 = sem rotação automática</span>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveVisual}
              disabled={updateConfig.isPending}
              className="h-10 px-6 rounded-xl text-sm font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
            >
              {updateConfig.isPending ? "Salvando..." : "Salvar configurações"}
            </button>
            {updateConfig.isSuccess && (
              <span className="text-xs text-emerald-600 font-semibold">Salvo com sucesso!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
