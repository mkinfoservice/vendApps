import { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Image,
  Type,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  useEnrichmentBatches,
  useCreateBatch,
  useReprocessWithoutImage,
  usePendingNames,
  useApproveName,
  useRejectName,
  useBulkApproveNames,
  useApproveAllNames,
  usePendingImages,
  useApproveImage,
  useRejectImage,
  useEnrichmentConfig,
  useUpdateEnrichmentConfig,
} from "@/features/admin/enrichment/queries";
import type {
  EnrichmentBatchResponse,
  EnrichmentConfigResponse,
  EnrichmentScope,
  ImageCandidateResponse,
  NameSuggestionResponse,
} from "@/features/admin/enrichment/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR");
}

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function resolveUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Queued: "bg-gray-100 text-gray-600",
  Running: "bg-blue-100 text-blue-700",
  Done: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status === "Running" && <RefreshCw className="w-3 h-3 animate-spin" />}
      {status === "Done" && <CheckCircle2 className="w-3 h-3" />}
      {status === "Failed" && <XCircle className="w-3 h-3" />}
      {status === "Queued" && <Clock className="w-3 h-3" />}
      {status}
    </span>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

type Tab = "batches" | "names" | "images" | "config";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "batches", label: "Lotes", icon: <Sparkles className="w-4 h-4" /> },
  { id: "names", label: "Revisão de Nomes", icon: <Type className="w-4 h-4" /> },
  { id: "images", label: "Revisão de Imagens", icon: <Image className="w-4 h-4" /> },
  { id: "config", label: "Configuração", icon: <Settings2 className="w-4 h-4" /> },
];

// ── Batch card ─────────────────────────────────────────────────────────────────

function BatchCard({ batch }: { batch: EnrichmentBatchResponse }) {
  const progress = pct(batch.processed, batch.totalQueued);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={batch.status} />
          <span className="text-xs text-gray-500">{batch.trigger}</span>
        </div>
        <span className="text-xs text-gray-400">{formatDate(batch.startedAtUtc)}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{batch.processed} / {batch.totalQueued} processados</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <div className="font-semibold text-green-600">{batch.namesNormalized}</div>
          <div className="text-gray-500">Nomes</div>
        </div>
        <div>
          <div className="font-semibold text-blue-600">{batch.imagesApplied}</div>
          <div className="text-gray-500">Imagens</div>
        </div>
        <div>
          <div className="font-semibold text-amber-600">{batch.pendingReview}</div>
          <div className="text-gray-500">Revisão</div>
        </div>
        <div>
          <div className="font-semibold text-red-500">{batch.failedItems}</div>
          <div className="text-gray-500">Falhas</div>
        </div>
      </div>

      {batch.errorMessage && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {batch.errorMessage}
        </div>
      )}
    </div>
  );
}

// ── Batches tab ────────────────────────────────────────────────────────────────

function BatchesTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useEnrichmentBatches(page);
  const createBatch = useCreateBatch();
  const reprocess = useReprocessWithoutImage();

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));

  function handleCreate(scope: EnrichmentScope) {
    createBatch.mutate({ scope, includeImages: true });
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleCreate("all")}
          disabled={createBatch.isPending}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          Enriquecer todos
        </button>
        <button
          onClick={() => handleCreate("without-image")}
          disabled={createBatch.isPending}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Image className="w-4 h-4" />
          Sem imagem
        </button>
        <button
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Reprocessar sem imagem
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Carregando...</div>
      ) : data?.items.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          Nenhum lote encontrado. Dispare um lote para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((b) => <BatchCard key={b.id} batch={b} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Name review row ────────────────────────────────────────────────────────────

function NameRow({
  item,
  selected,
  onSelect,
  onApprove,
  onReject,
}: {
  item: NameSuggestionResponse;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(item.id, e.target.checked)}
          className="rounded"
        />
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px] truncate">{item.productName}</td>
      <td className="px-3 py-2 text-xs text-gray-700">{item.originalName}</td>
      <td className="px-3 py-2 text-xs font-medium text-violet-700">{item.suggestedName}</td>
      <td className="px-3 py-2 text-xs text-center">
        <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${item.confidenceScore >= 0.9 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {(item.confidenceScore * 100).toFixed(0)}%
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onApprove(item.id)}
            title="Aprovar"
            className="p-1 rounded hover:bg-green-50 text-green-600"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onReject(item.id)}
            title="Rejeitar"
            className="p-1 rounded hover:bg-red-50 text-red-500"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Names tab ──────────────────────────────────────────────────────────────────

function NamesTab() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, isLoading } = usePendingNames(page);
  const approve = useApproveName();
  const reject = useRejectName();
  const bulkApprove = useBulkApproveNames();
  const approveAll = useApproveAllNames();

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 30)));

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

  function handleBulkApprove() {
    if (selected.size === 0) return;
    bulkApprove.mutate([...selected], { onSuccess: () => setSelected(new Set()) });
  }

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(data?.total ?? 0) > 0 && (
          <button
            onClick={() => approveAll.mutate()}
            disabled={approveAll.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {approveAll.isPending ? "Aplicando..." : `Aprovar Todos (${data?.total ?? 0})`}
          </button>
        )}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
            <span className="text-xs text-violet-700 font-medium">{selected.size} selecionados</span>
            <button
              onClick={handleBulkApprove}
              disabled={bulkApprove.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              Aprovar
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
              Limpar
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          Nenhuma sugestão pendente de revisão.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Produto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nome original</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Sugestão</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Score</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <NameRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onSelect={toggleSelect}
                  onApprove={(id) => approve.mutate(id)}
                  onReject={(id) => reject.mutate(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Image card ─────────────────────────────────────────────────────────────────

function ImageCard({
  item,
  onApprove,
  onReject,
}: {
  item: ImageCandidateResponse;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const imgUrl = item.candidateUrl?.startsWith("http") ? item.candidateUrl : resolveUrl(item.candidateUrl);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="aspect-square relative bg-gray-100">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.candidateName ?? "candidata"}
            className="w-full h-full object-contain p-2"
            onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Image className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${item.confidenceScore >= 0.9 ? "bg-green-500 text-white" : "bg-amber-400 text-white"}`}>
            {(item.confidenceScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div>
          <div className="text-xs font-medium text-gray-900 line-clamp-1">{item.productName}</div>
          {item.candidateName && (
            <div className="text-[11px] text-gray-500 line-clamp-1">{item.candidateName}</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">{item.source}</span>
          <div className="flex gap-1">
            <button
              onClick={() => onReject(item.id)}
              title="Rejeitar"
              className="p-1 rounded hover:bg-red-50 text-red-500"
            >
              <XCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onApprove(item.id)}
              title="Aprovar e aplicar"
              className="p-1 rounded hover:bg-green-50 text-green-600"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Images tab ─────────────────────────────────────────────────────────────────

function ImagesTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePendingImages(page);
  const approve = useApproveImage();
  const reject = useRejectImage();

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          Nenhuma imagem pendente de revisão.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => (
            <ImageCard
              key={item.id}
              item={item}
              onApprove={(id) => approve.mutate(id)}
              onReject={(id) => reject.mutate(id)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Config tab ─────────────────────────────────────────────────────────────────

function ConfigTab() {
  const { data, isLoading } = useEnrichmentConfig();
  const update = useUpdateEnrichmentConfig();
  const [overrides, setOverrides] = useState<Partial<EnrichmentConfigResponse>>({});
  const [saved, setSaved] = useState(false);

  // Merge server values with local overrides — always a complete object when data is loaded
  const current = { ...(data ?? {}), ...overrides } as EnrichmentConfigResponse;

  function handleChange<K extends keyof EnrichmentConfigResponse>(
    key: K,
    value: EnrichmentConfigResponse[K]
  ) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    if (!data) return; // config not yet loaded
    // Send full object — backend requires all 7 fields
    update.mutate({ ...data, ...overrides }, {
      onSuccess: () => {
        setSaved(true);
        setOverrides({});
      },
    });
  }

  if (isLoading) return <div className="text-sm text-gray-500 py-8 text-center">Carregando...</div>;

  return (
    <div className="max-w-lg space-y-5">
      {/* Toggles */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Funcionalidades</h3>

        <label className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Normalização de nomes</div>
            <div className="text-xs text-gray-500">Corrige formatação e abreviações</div>
          </div>
          <input
            type="checkbox"
            checked={current.enableNameNormalization ?? true}
            onChange={(e) => handleChange("enableNameNormalization", e.target.checked)}
            className="w-4 h-4 rounded"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Matching de imagens</div>
            <div className="text-xs text-gray-500">Busca imagens por código de barras</div>
          </div>
          <input
            type="checkbox"
            checked={current.enableImageMatching ?? false}
            onChange={(e) => handleChange("enableImageMatching", e.target.checked)}
            className="w-4 h-4 rounded"
          />
        </label>
      </section>

      {/* Thresholds */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Thresholds de confiança</h3>

        {(
          [
            {
              key: "autoApplyImageThreshold" as const,
              label: "Auto-aplicar imagem",
              hint: "Score mínimo para aplicar imagem automaticamente",
            },
            {
              key: "reviewImageThreshold" as const,
              label: "Revisão de imagem",
              hint: "Score mínimo para enviar à fila de revisão",
            },
            {
              key: "autoApplyNameThreshold" as const,
              label: "Auto-aplicar nome",
              hint: "Score mínimo para aplicar nome automaticamente (0.70 = aplica quase tudo)",
            },
          ] as const
        ).map(({ key, label, hint }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">{label}</label>
              <span className="text-xs font-mono text-violet-700">
                {((current[key] ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={current[key] ?? 0}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="text-xs text-gray-400">{hint}</div>
          </div>
        ))}
      </section>

      {/* Performance */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Performance</h3>

        <div>
          <label className="text-sm font-medium text-gray-700">Tamanho do lote</label>
          <input
            type="number"
            min={1}
            max={200}
            value={current.batchSize ?? 50}
            onChange={(e) => handleChange("batchSize", parseInt(e.target.value, 10))}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Delay entre itens (ms)</label>
          <input
            type="number"
            min={0}
            max={5000}
            value={current.delayBetweenItemsMs ?? 500}
            onChange={(e) => handleChange("delayBetweenItemsMs", parseInt(e.target.value, 10))}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <div className="text-xs text-gray-400 mt-0.5">Pausa entre chamadas à API de imagens</div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={update.isPending || !data}
          className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50"
        >
          {update.isPending ? "Salvando..." : "Salvar configurações"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo!</span>}
        {update.isError && (
          <span className="text-sm text-red-600">Erro ao salvar.</span>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CatalogEnrichmentPage() {
  const [tab, setTab] = useState<Tab>("batches");

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Enriquecimento de Catálogo"
        subtitle="Normaliza nomes e busca imagens automaticamente para seus produtos"
      />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "batches" && <BatchesTab />}
      {tab === "names" && <NamesTab />}
      {tab === "images" && <ImagesTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}
