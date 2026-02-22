import { useState } from "react";
import {
  X, Database, Globe, FileText, RefreshCw,
  CheckCircle2, XCircle, Loader2, Plus, ArrowLeft,
} from "lucide-react";
import { useCreateSource, useSources, useSyncJob, useTriggerSync } from "./queries";
import { testConnection } from "./api";
import type { CreateSourceRequest, SourceListItem, SyncJobResponse } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_TYPE_ICON: Record<string, React.ElementType> = {
  Db: Database,
  Api: Globe,
  File: FileText,
};

const CONNECTOR_LABEL: Record<string, string> = {
  MySql: "MySQL",
  Postgres: "PostgreSQL",
  SqlServer: "SQL Server",
  Oracle: "Oracle",
  Firebird: "Firebird",
  RestErp: "REST / ERP",
  Csv: "CSV",
};

function formatDate(iso: string | null) {
  if (!iso) return "Nunca sincronizado";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

// ── JobResult ─────────────────────────────────────────────────────────────────

function JobResult({ job }: { job: SyncJobResponse }) {
  const isRunning = job.status === "Queued" || job.status === "Running";
  const isDone = job.status === "Done";
  const isFailed = job.status === "Failed";

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{
        borderColor: isFailed
          ? "rgba(248,113,113,0.4)"
          : isDone
          ? "rgba(52,211,153,0.4)"
          : "var(--border)",
        backgroundColor: isFailed
          ? "rgba(248,113,113,0.07)"
          : isDone
          ? "rgba(52,211,153,0.07)"
          : "var(--surface-2)",
      }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {isRunning && <Loader2 size={14} className="animate-spin" style={{ color: "#7c5cf8" }} />}
        {isDone && <CheckCircle2 size={14} style={{ color: "#34d399" }} />}
        {isFailed && <XCircle size={14} style={{ color: "#f87171" }} />}
        <span style={{ color: isRunning ? "#7c5cf8" : isDone ? "#34d399" : "#f87171" }}>
          {isRunning ? "Sincronizando..." : isDone ? "Concluído" : "Falhou"}
        </span>
      </div>

      {isFailed && job.errorMessage && (
        <p className="text-xs" style={{ color: "#f87171" }}>{job.errorMessage}</p>
      )}

      {isDone && (
        <div className="grid grid-cols-4 gap-2 pt-1">
          {[
            { label: "Novos", value: job.inserted, color: "#34d399" },
            { label: "Atualizados", value: job.updated, color: "#60a5fa" },
            { label: "Iguais", value: job.unchanged, color: "var(--text-muted)" },
            { label: "Conflitos", value: job.conflicts, color: "#f87171" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-base font-extrabold" style={{ color }}>{value}</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SourceCard ────────────────────────────────────────────────────────────────

function SourceCard({
  source,
  onSync,
  isSyncing,
  activeJobId,
}: {
  source: SourceListItem;
  onSync: (sourceId: string) => void;
  isSyncing: boolean;
  activeJobId: string | null;
}) {
  const jobQuery = useSyncJob(activeJobId);
  const Icon = SOURCE_TYPE_ICON[source.sourceType] ?? Database;
  const isRunning =
    isSyncing ||
    jobQuery.data?.status === "Queued" ||
    jobQuery.data?.status === "Running";

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(124,92,248,0.12)", color: "#7c5cf8" }}
          >
            <Icon size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {source.name}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {CONNECTOR_LABEL[source.connectorType] ?? source.connectorType}
            </div>
          </div>
        </div>

        <button
          onClick={() => onSync(source.id)}
          disabled={isRunning || !source.isActive}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
          style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          title={!source.isActive ? "Fonte inativa" : ""}
        >
          <RefreshCw size={12} className={isRunning ? "animate-spin" : ""} />
          {isRunning ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Última sincronização: {formatDate(source.lastSyncAtUtc)}
      </div>

      {!source.isActive && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">
          Inativa
        </span>
      )}

      {jobQuery.data && <JobResult job={jobQuery.data} />}
    </div>
  );
}

// ── AddSourceForm ─────────────────────────────────────────────────────────────

type ConnectorType = "Csv" | "RestErp";

type FormState = {
  name: string;
  connectorType: ConnectorType;
  // CSV
  filePath: string;
  delimiter: string;
  // REST
  url: string;
  apiKey: string;
  pageParam: string;
  sizeParam: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  connectorType: "Csv",
  filePath: "",
  delimiter: ",",
  url: "",
  apiKey: "",
  pageParam: "page",
  sizeParam: "size",
};

function inputClass() {
  return "w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40";
}

function inputStyle(): React.CSSProperties {
  return {
    backgroundColor: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };
}

function labelStyle(): React.CSSProperties {
  return { color: "var(--text-muted)" };
}

function AddSourceForm({ onBack }: { onBack: () => void }) {
  const createMut = useCreateSource();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setTestResult(null);
  }

  function buildConfig(): string {
    if (form.connectorType === "Csv") {
      return JSON.stringify({
        FilePath: form.filePath.trim(),
        Delimiter: form.delimiter.trim() || ",",
      });
    }
    return JSON.stringify({
      Url: form.url.trim(),
      ApiKey: form.apiKey.trim() || undefined,
      PageParam: form.pageParam.trim() || "page",
      SizeParam: form.sizeParam.trim() || "size",
    });
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) { setError("Informe um nome para a fonte."); return; }
    if (form.connectorType === "Csv" && !form.filePath.trim()) {
      setError("Informe o caminho do arquivo CSV."); return;
    }
    if (form.connectorType === "RestErp" && !form.url.trim()) {
      setError("Informe a URL da API."); return;
    }

    const req: CreateSourceRequest = {
      name: form.name.trim(),
      sourceType: form.connectorType === "Csv" ? "File" : "Api",
      connectorType: form.connectorType,
      connectionConfigJson: buildConfig(),
      isActive: true,
      syncMode: "Manual",
      scheduleCron: null,
    };

    try {
      const res = await createMut.mutateAsync(req);
      setSavedId(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fonte.");
    }
  }

  async function handleTest() {
    if (!savedId) {
      setError("Salve a fonte primeiro para testar a conexão.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection(savedId);
      setTestResult({ success: res.success, message: res.message });
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Erro ao testar conexão." });
    } finally {
      setTesting(false);
    }
  }

  if (savedId && testResult?.success) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} style={{ color: "#34d399" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              Fonte configurada com sucesso!
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {testResult.message}
            </p>
          </div>
          <button
            onClick={onBack}
            className="h-9 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          >
            Ver fontes e sincronizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Tipo de conector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold" style={labelStyle()}>
          Tipo de fonte
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["Csv", "RestErp"] as ConnectorType[]).map((type) => {
            const Icon = type === "Csv" ? FileText : Globe;
            const label = type === "Csv" ? "Arquivo CSV" : "API REST";
            const active = form.connectorType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => set("connectorType", type)}
                className="flex items-center gap-2 h-11 px-3 rounded-xl border text-sm font-semibold transition-all"
                style={{
                  borderColor: active ? "#7c5cf8" : "var(--border)",
                  backgroundColor: active ? "rgba(124,92,248,0.1)" : "var(--surface-2)",
                  color: active ? "#7c5cf8" : "var(--text-muted)",
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Banco de dados relacional estará disponível em breve.
        </p>
      </div>

      {/* Nome */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold" style={labelStyle()}>
          Nome da fonte *
        </label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ex: Importação CSV Produtos"
          className={inputClass()}
          style={inputStyle()}
        />
      </div>

      {/* CSV fields */}
      {form.connectorType === "Csv" && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>
              Caminho do arquivo *
            </label>
            <input
              value={form.filePath}
              onChange={(e) => set("filePath", e.target.value)}
              placeholder="Ex: /data/produtos.csv"
              className={inputClass()}
              style={inputStyle()}
            />
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Caminho absoluto no servidor onde o arquivo CSV está salvo.
              Colunas esperadas: Name, PriceCents, CostCents, StockQty, CategoryName, Barcode, InternalCode, IsActive.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>
              Separador
            </label>
            <input
              value={form.delimiter}
              onChange={(e) => set("delimiter", e.target.value)}
              placeholder=","
              maxLength={2}
              className={inputClass()}
              style={inputStyle()}
            />
          </div>
        </>
      )}

      {/* REST fields */}
      {form.connectorType === "RestErp" && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>
              URL da API *
            </label>
            <input
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://erp.exemplo.com/api/products"
              className={inputClass()}
              style={inputStyle()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>
              Chave de API (Bearer)
            </label>
            <input
              value={form.apiKey}
              onChange={(e) => set("apiKey", e.target.value)}
              placeholder="Opcional"
              className={inputClass()}
              style={inputStyle()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={labelStyle()}>
                Parâmetro de página
              </label>
              <input
                value={form.pageParam}
                onChange={(e) => set("pageParam", e.target.value)}
                placeholder="page"
                className={inputClass()}
                style={inputStyle()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={labelStyle()}>
                Parâmetro de tamanho
              </label>
              <input
                value={form.sizeParam}
                onChange={(e) => set("sizeParam", e.target.value)}
                placeholder="size"
                className={inputClass()}
                style={inputStyle()}
              />
            </div>
          </div>
        </>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Resultado do teste */}
      {testResult && (
        <div
          className="rounded-xl border p-3 text-xs font-medium flex items-center gap-2"
          style={{
            borderColor: testResult.success ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)",
            backgroundColor: testResult.success ? "rgba(52,211,153,0.07)" : "rgba(248,113,113,0.07)",
            color: testResult.success ? "#34d399" : "#f87171",
          }}
        >
          {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {testResult.message}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 pt-1">
        {savedId && (
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl border text-sm font-semibold transition-all hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Testar conexão
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={createMut.isPending || !!savedId}
          className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
        >
          {createMut.isPending ? "Salvando..." : savedId ? "Salvo ✓" : "Salvar fonte"}
        </button>
      </div>
    </div>
  );
}

// ── SyncModal ─────────────────────────────────────────────────────────────────

type View = "list" | "add";

export function SyncModal({ onClose }: { onClose: () => void }) {
  const sourcesQuery = useSources();
  const triggerSync = useTriggerSync();
  const [view, setView] = useState<View>("list");
  const [jobMap, setJobMap] = useState<Record<string, string>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function handleSync(sourceId: string) {
    setSyncingId(sourceId);
    try {
      const job = await triggerSync.mutateAsync({ sourceId, syncType: "Full" });
      setJobMap((prev) => ({ ...prev, [sourceId]: job.id }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao disparar sincronização.");
    } finally {
      setSyncingId(null);
    }
  }

  const sources = sourcesQuery.data ?? [];
  const isAdd = view === "add";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            {isAdd && (
              <button
                onClick={() => setView("list")}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: "var(--text-muted)" }}
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>
                {isAdd ? "Adicionar fonte" : "Importar produtos"}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {isAdd
                  ? "Configure de onde importar os produtos"
                  : "Selecione a fonte e clique em Sincronizar"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {isAdd ? (
          <AddSourceForm onBack={() => setView("list")} />
        ) : (
          <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
            {sourcesQuery.isLoading && (
              <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Carregando fontes...
              </div>
            )}

            {sourcesQuery.isError && (
              <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
                Erro ao carregar fontes de dados.
              </div>
            )}

            {!sourcesQuery.isLoading && sources.length === 0 && (
              <div className="py-6 text-center space-y-3">
                <Database size={32} className="mx-auto opacity-30" style={{ color: "var(--text-muted)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    Nenhuma fonte configurada
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Adicione uma fonte de dados para importar produtos
                  </p>
                </div>
                <button
                  onClick={() => setView("add")}
                  className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold text-white mx-auto transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
                >
                  <Plus size={15} />
                  Adicionar fonte
                </button>
              </div>
            )}

            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onSync={handleSync}
                isSyncing={syncingId === source.id}
                activeJobId={jobMap[source.id] ?? null}
              />
            ))}

            {sources.length > 0 && (
              <button
                onClick={() => setView("add")}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border text-sm font-semibold transition-all hover:bg-[var(--surface)]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <Plus size={14} />
                Adicionar outra fonte
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
