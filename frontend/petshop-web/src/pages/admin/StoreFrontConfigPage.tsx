import { useState } from "react";
import { Paintbrush, Image, Plus, Trash2, GripVertical, ExternalLink, Tag, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  useStoreFrontConfig,
  useUpdateStoreFrontConfig,
  useAddSlide,
  useUpdateSlide,
  useDeleteSlide,
  useReorderSlides,
} from "@/features/admin/storefront/queries";
import type { BannerSlideResponse, UpsertBannerSlideRequest } from "@/features/admin/storefront/types";

// ── helpers ────────────────────────────────────────────────────────────────────

const CTA_TYPES = [
  { value: "none",     label: "Sem destino",        icon: null },
  { value: "category", label: "Grupo de produtos",  icon: Tag },
  { value: "product",  label: "Produto específico", icon: Package },
  { value: "external", label: "URL externa",        icon: ExternalLink },
] as const;

function ctaLabel(type: string) {
  return CTA_TYPES.find((t) => t.value === type)?.label ?? "Sem destino";
}

// ── SlideForm ─────────────────────────────────────────────────────────────────

interface SlideFormProps {
  initial?: Partial<UpsertBannerSlideRequest>;
  onSave: (data: UpsertBannerSlideRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

function SlideForm({ initial, onSave, onCancel, loading }: SlideFormProps) {
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
    <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-semibold text-gray-600">URL da imagem</span>
          <input
            value={form.imageUrl ?? ""}
            onChange={(e) => set("imageUrl", e.target.value)}
            placeholder="https://... (deixe vazio para fundo colorido)"
            className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
          />
        </label>

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
            placeholder="Ex: Desconto em produtos selecionados"
            maxLength={200}
            className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
          />
        </label>
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Tipo de destino (botão)</span>
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
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                {form.ctaType === "category" ? "Slug da categoria" :
                 form.ctaType === "product"  ? "ID do produto (UUID)" : "URL destino"}
              </span>
              <input
                value={form.ctaTarget ?? ""}
                onChange={(e) => set("ctaTarget", e.target.value)}
                placeholder={
                  form.ctaType === "category" ? "ex: racao" :
                  form.ctaType === "product"  ? "ex: 550e8400-e29b..." :
                  "https://..."
                }
                className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">Texto do botão</span>
              <input
                value={form.ctaText ?? ""}
                onChange={(e) => set("ctaText", e.target.value)}
                placeholder="Ex: Ver Ofertas"
                maxLength={60}
                className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] outline-none"
              />
            </label>
          </>
        )}
      </div>

      {form.ctaType === "external" && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={form.ctaNewTab ?? false}
            onChange={(e) => set("ctaNewTab", e.target.checked)}
            className="accent-[#7c5cf8]"
          />
          Abrir em nova aba
        </label>
      )}

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
      {/* Thumb */}
      <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
        {slide.imageUrl
          ? <img src={slide.imageUrl} alt={slide.title ?? ""} className="w-full h-full object-cover" />
          : <Image className="w-5 h-5 text-gray-300" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{slide.title || "(sem título)"}</p>
        <p className="text-xs text-gray-400 truncate">{slide.subtitle || ""}</p>
        {slide.ctaType !== "none" && (
          <span className="text-[10px] font-semibold text-[#7c5cf8] mt-0.5 inline-block">
            {ctaLabel(slide.ctaType)}: {slide.ctaTarget}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={onMoveUp} disabled={index === 0}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"
          aria-label="Mover para cima">
          <GripVertical className="w-3.5 h-3.5 text-gray-400 rotate-90" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center rotate-180"
          aria-label="Mover para baixo">
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
  const updateConfig    = useUpdateStoreFrontConfig();
  const addSlide        = useAddSlide();
  const updateSlide     = useUpdateSlide();
  const deleteSlide     = useDeleteSlide();
  const reorderSlides   = useReorderSlides();

  const [color, setColor] = useState("");
  const [interval, setIntervalSecs] = useState(5);

  // Sync local state com dados carregados
  if (config && color === "") {
    setColor(config.primaryColor);
    setIntervalSecs(config.bannerIntervalSecs);
  }

  const handleSaveVisual = () => {
    updateConfig.mutate({ primaryColor: color || "#7c5cf8", bannerIntervalSecs: interval });
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
        title="Configuração da Loja Online"
        subtitle="Personalize banner, cores e identidade visual da sua loja"
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

      {/* ── TAB: BANNERS ─────────────────────────────────────────────────────── */}
      {tab === "banners" && config && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Slides do Banner</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {config.slides.length === 0
                  ? "Nenhum slide — usando banner padrão"
                  : `${config.slides.length} slide${config.slides.length !== 1 ? "s" : ""}`}
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

          {/* Form de adição */}
          {adding && (
            <SlideForm
              onSave={(data) => addSlide.mutate(data, { onSuccess: () => setAdding(false) })}
              onCancel={() => setAdding(false)}
              loading={addSlide.isPending}
            />
          )}

          {/* Lista de slides */}
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
                  onEdit={() => setEditingId(slide.id)}
                  onDelete={() => {
                    if (confirm("Remover este slide?")) deleteSlide.mutate(slide.id);
                  }}
                  onMoveUp={() => moveSlide(i, "up")}
                  onMoveDown={() => moveSlide(i, "down")}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* ── TAB: VISUAL ──────────────────────────────────────────────────────── */}
      {tab === "visual" && config && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-[#7c5cf8]" />
              Identidade Visual
            </h3>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">Cor primária da marca</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color || "#7c5cf8"}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  value={color || "#7c5cf8"}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#7c5cf8"
                  maxLength={10}
                  className="h-10 w-32 px-3 rounded-xl border border-gray-200 text-sm font-mono bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
                />
                <div
                  className="flex-1 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${color || "#7c5cf8"}, ${color || "#7c5cf8"}cc)` }}
                >
                  Preview
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Usada nos botões, badges e destaques da loja.
                <span className="text-amber-500 font-medium"> (Funcionalidade em desenvolvimento — em breve aplicada dinamicamente)</span>
              </p>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">Intervalo do banner (segundos)</span>
              <input
                type="number"
                min={0}
                max={30}
                value={interval}
                onChange={(e) => setIntervalSecs(Number(e.target.value))}
                className="h-10 w-24 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#7c5cf8] outline-none"
              />
              <p className="text-xs text-gray-400">0 = sem rotação automática</p>
            </label>
          </div>

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
            <p className="text-xs text-emerald-600 font-semibold">Salvo com sucesso!</p>
          )}
        </div>
      )}
    </div>
  );
}
