import { useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useCreateSource } from "./queries";
import { testConnection, updateSource } from "./api";
import { useDbTables, useDbColumns } from "./queries";
import { DTO_FIELDS, type DtoFieldName, type TestConnectionResponse } from "./types";

// ── Styles helpers ────────────────────────────────────────────────────────────

function inputClass() {
  return "w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40";
}

function inputStyle(): React.CSSProperties {
  return { backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
}

function labelStyle(): React.CSSProperties {
  return { color: "var(--text-muted)" };
}

function primaryBtn(disabled?: boolean): React.CSSProperties {
  return {
    background: disabled ? "rgba(124,92,248,0.4)" : "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

// ── Provider buttons ──────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "MySql",      label: "MySQL" },
  { value: "Postgres",   label: "PostgreSQL" },
  { value: "SqlServer",  label: "SQL Server" },
  { value: "Firebird",   label: "Firebird" },
] as const;

type ProviderValue = typeof PROVIDERS[number]["value"];

// ── Step 1 state ──────────────────────────────────────────────────────────────

type Step1State = {
  name: string;
  mode: "live" | "dump";
  provider: ProviderValue;
  connectionString: string;
  filePath: string;
  priceUnit: "auto" | "cents" | "reais";
};

// ── ColumnMappingRow ──────────────────────────────────────────────────────────

function ColumnMappingRow({
  columnName,
  dataType,
  isNullable,
  sampleValues,
  value,
  onChange,
}: {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  sampleValues: string[];
  value: DtoFieldName | "";
  onChange: (v: DtoFieldName | "") => void;
}) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td className="py-2 pr-3 text-sm" style={{ color: "var(--text)" }}>
        <div className="font-medium">{columnName}</div>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {dataType}{isNullable ? "" : " NOT NULL"}
          {sampleValues.length > 0 && (
            <span className="ml-1 opacity-70">
              ({sampleValues.slice(0, 3).join(", ")})
            </span>
          )}
        </div>
      </td>
      <td className="py-2 pl-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as DtoFieldName | "")}
          className="w-full h-9 rounded-xl border px-2 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/40"
          style={inputStyle()}
        >
          <option value="">— ignorar —</option>
          {DTO_FIELDS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// ── DbSourceWizard ────────────────────────────────────────────────────────────

export function DbSourceWizard({ onBack }: { onBack: () => void }) {
  const createMut = useCreateSource();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  // Step 1
  const [s1, setS1] = useState<Step1State>({
    name: "",
    mode: "live",
    provider: "MySql",
    connectionString: "",
    filePath: "",
    priceUnit: "auto",
  });
  const [savedId, setSavedId] = useState<string | null>(null);

  // Step 2
  const tablesQuery = useDbTables(savedId);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [updatedAtColumn, setUpdatedAtColumn] = useState("");

  // Step 3
  const columnsQuery = useDbColumns(savedId, selectedTable);
  const [mapping, setMapping] = useState<Record<string, DtoFieldName | "">>({});

  function setMap(col: string, val: DtoFieldName | "") {
    setMapping((prev) => ({ ...prev, [col]: val }));
  }

  // Auto-map when columns load
  function autoMap(cols: { columnName: string }[]) {
    const autoMapped: Record<string, DtoFieldName | ""> = {};
    for (const col of cols) {
      const match = DTO_FIELDS.find(
        (f) => f.toLowerCase() === col.columnName.toLowerCase()
      );
      autoMapped[col.columnName] = match ?? "";
    }
    setMapping(autoMapped);
  }

  // ── Step 1: helpers ───────────────────────────────────────────────────────

  function validateStep1(): string | null {
    if (!s1.name.trim()) return "Informe um nome para a fonte.";
    if (s1.mode === "live" && !s1.connectionString.trim()) return "Informe a connection string.";
    if (s1.mode === "dump" && !s1.filePath.trim()) return "Informe o caminho do arquivo .sql.";
    return null;
  }

  function buildStep1Config(): string {
    return JSON.stringify({
      Mode: s1.mode,
      Provider: s1.provider,
      ConnectionString: s1.mode === "live" ? s1.connectionString.trim() : undefined,
      FilePath: s1.mode === "dump" ? s1.filePath.trim() : undefined,
      PriceUnit: s1.priceUnit,
      TableName: "produtos",
      ColumnMapping: {},
    });
  }

  async function ensureSaved(): Promise<string> {
    const config = buildStep1Config();
    if (savedId) {
      await updateSource(savedId, { connectionConfigJson: config });
      return savedId;
    }
    const res = await createMut.mutateAsync({
      name: s1.name.trim(),
      sourceType: "Db",
      connectorType: s1.provider,
      connectionConfigJson: config,
      isActive: true,
      syncMode: "Manual",
      scheduleCron: null,
    });
    setSavedId(res.id);
    return res.id;
  }

  async function handleTestConnection() {
    setError(null);
    setTestResult(null);
    const err = validateStep1();
    if (err) { setError(err); return; }
    setTestingConn(true);
    try {
      const id = await ensureSaved();
      const result = await testConnection(id);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao testar conexão.");
    } finally {
      setTestingConn(false);
    }
  }

  // ── Step 1: Salvar fonte ──────────────────────────────────────────────────

  async function handleStep1Save() {
    setError(null);
    const err = validateStep1();
    if (err) { setError(err); return; }
    try {
      await ensureSaved();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fonte.");
    }
  }

  // ── Step 2: Selecionar tabela ─────────────────────────────────────────────

  async function handleStep2Next() {
    if (!selectedTable) { setError("Selecione uma tabela."); return; }
    setError(null);

    // Atualiza config com tableName e updatedAtColumn
    const currentConfig = JSON.parse(JSON.stringify({
      Mode: s1.mode,
      Provider: s1.provider,
      ConnectionString: s1.mode === "live" ? s1.connectionString.trim() : undefined,
      FilePath: s1.mode === "dump" ? s1.filePath.trim() : undefined,
      PriceUnit: s1.priceUnit,
      TableName: selectedTable,
      UpdatedAtColumn: updatedAtColumn.trim() || undefined,
      ColumnMapping: {},
    }));

    await updateSource(savedId!, { connectionConfigJson: JSON.stringify(currentConfig) });

    // Trigger columns load and auto-map
    setStep(3);
  }

  // When columns query succeeds, auto-map
  const columnsData = columnsQuery.data?.columns;
  const [autoMapped, setAutoMapped] = useState(false);
  if (columnsData && !autoMapped && step === 3) {
    autoMap(columnsData);
    setAutoMapped(true);
  }

  // ── Step 3: Mapeamento de colunas ─────────────────────────────────────────

  function handleStep3Next() {
    setError(null);
    const nameMapped = Object.values(mapping).some(
      (v) => v === "Name"
    );
    if (!nameMapped) {
      setError("Mapeie ao menos uma coluna para o campo 'Name'.");
      return;
    }
    setStep(4);
  }

  // ── Step 4: Salvar mapeamento final ───────────────────────────────────────

  async function handleFinalSave() {
    setSaving(true);
    setError(null);
    try {
      // Mapeamento: coluna externa → campo DTO (somente os mapeados)
      const columnMapping: Record<string, string> = {};
      for (const [col, dtoField] of Object.entries(mapping)) {
        if (dtoField) columnMapping[col] = dtoField;
      }

      const finalConfig = JSON.stringify({
        Mode: s1.mode,
        Provider: s1.provider,
        ConnectionString: s1.mode === "live" ? s1.connectionString.trim() : undefined,
        FilePath: s1.mode === "dump" ? s1.filePath.trim() : undefined,
        PriceUnit: s1.priceUnit,
        TableName: selectedTable,
        UpdatedAtColumn: updatedAtColumn.trim() || undefined,
        ColumnMapping: columnMapping,
      });

      await updateSource(savedId!, { connectionConfigJson: finalConfig });
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar mapeamento.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Progress indicator */}
      <div className="flex items-center gap-1 text-xs mb-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: step >= n ? "#7c5cf8" : "var(--surface-2)",
                color: step >= n ? "#fff" : "var(--text-muted)",
                border: `1px solid ${step >= n ? "#7c5cf8" : "var(--border)"}`,
              }}
            >
              {n}
            </div>
            {n < 4 && <div className="w-6 h-px" style={{ backgroundColor: step > n ? "#7c5cf8" : "var(--border)" }} />}
          </div>
        ))}
        <span className="ml-2" style={{ color: "var(--text-muted)" }}>
          {step === 1 && "Conexão"}
          {step === 2 && "Tabela"}
          {step === 3 && "Mapeamento"}
          {step === 4 && "Confirmar"}
        </span>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>Nome da fonte *</label>
            <input
              value={s1.name}
              onChange={(e) => setS1((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: MySQL Produtos"
              className={inputClass()}
              style={inputStyle()}
            />
          </div>

          {/* Modo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>Modo</label>
            <div className="grid grid-cols-2 gap-2">
              {(["live", "dump"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setS1((p) => ({ ...p, mode: m }))}
                  className="h-10 rounded-xl border text-sm font-semibold transition-all"
                  style={{
                    borderColor: s1.mode === m ? "#7c5cf8" : "var(--border)",
                    backgroundColor: s1.mode === m ? "rgba(124,92,248,0.1)" : "var(--surface-2)",
                    color: s1.mode === m ? "#7c5cf8" : "var(--text-muted)",
                  }}
                >
                  {m === "live" ? "Conexão direta" : "Arquivo .sql (dump)"}
                </button>
              ))}
            </div>
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>Banco de dados</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setS1((p) => ({ ...p, provider: value }))}
                  className="h-10 rounded-xl border text-sm font-semibold transition-all"
                  style={{
                    borderColor: s1.provider === value ? "#7c5cf8" : "var(--border)",
                    backgroundColor: s1.provider === value ? "rgba(124,92,248,0.1)" : "var(--surface-2)",
                    color: s1.provider === value ? "#7c5cf8" : "var(--text-muted)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Connection string ou FilePath */}
          {s1.mode === "live" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={labelStyle()}>Connection string *</label>
              <input
                value={s1.connectionString}
                onChange={(e) => setS1((p) => ({ ...p, connectionString: e.target.value }))}
                placeholder="Server=...;Database=...;User=...;Password=..."
                className={inputClass()}
                style={inputStyle()}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={labelStyle()}>Caminho do arquivo .sql *</label>
              <input
                value={s1.filePath}
                onChange={(e) => setS1((p) => ({ ...p, filePath: e.target.value }))}
                placeholder="/backups/produtos.sql"
                className={inputClass()}
                style={inputStyle()}
              />
            </div>
          )}

          {/* Unidade de preço */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={labelStyle()}>Unidade dos preços</label>
            <select
              value={s1.priceUnit}
              onChange={(e) => setS1((p) => ({ ...p, priceUnit: e.target.value as "auto" | "cents" | "reais" }))}
              className={inputClass()}
              style={inputStyle()}
            >
              <option value="auto">Auto ({">"} 1000 = centavos)</option>
              <option value="cents">Centavos (ex: 2990 = R$ 29,90)</option>
              <option value="reais">Reais (ex: 29.90 = R$ 29,90)</option>
            </select>
          </div>

          {error && <ErrorBox message={error} />}

          {testResult && (
            <div
              className="rounded-xl border p-3 text-xs flex items-start gap-2"
              style={{
                borderColor: testResult.success ? "#166534" : "#991b1b",
                backgroundColor: testResult.success ? "rgba(22,101,52,0.15)" : "rgba(153,27,27,0.15)",
                color: testResult.success ? "#4ade80" : "#f87171",
              }}
            >
              {testResult.success
                ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                : <XCircle size={13} className="shrink-0 mt-0.5" />}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConn || createMut.isPending}
              className="flex-1 h-10 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface-2)",
                color: "var(--text-muted)",
                cursor: testingConn || createMut.isPending ? "not-allowed" : "pointer",
                opacity: testingConn || createMut.isPending ? 0.6 : 1,
              }}
            >
              {testingConn ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Testar conexão
            </button>
            <button
              type="button"
              onClick={handleStep1Save}
              disabled={createMut.isPending || testingConn}
              className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={primaryBtn(createMut.isPending || testingConn)}
            >
              {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              Salvar e continuar
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Selecione a tabela de produtos
          </p>

          {tablesQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={14} className="animate-spin" /> Carregando tabelas...
            </div>
          )}

          {tablesQuery.isError && (
            <ErrorBox message="Erro ao carregar tabelas. Verifique a connection string." />
          )}

          {tablesQuery.data && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {tablesQuery.data.tables.map((t) => (
                <button
                  key={t.tableName}
                  type="button"
                  onClick={() => setSelectedTable(t.tableName)}
                  className="w-full text-left px-3 py-2 rounded-xl border text-sm transition-all"
                  style={{
                    borderColor: selectedTable === t.tableName ? "#7c5cf8" : "var(--border)",
                    backgroundColor: selectedTable === t.tableName ? "rgba(124,92,248,0.1)" : "var(--surface-2)",
                    color: selectedTable === t.tableName ? "#7c5cf8" : "var(--text)",
                  }}
                >
                  <span className="font-medium">{t.tableName}</span>
                  {t.rowCount != null && (
                    <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      ~{t.rowCount.toLocaleString("pt-BR")} linhas
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedTable && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={labelStyle()}>
                Coluna de atualização (delta sync, opcional)
              </label>
              <input
                value={updatedAtColumn}
                onChange={(e) => setUpdatedAtColumn(e.target.value)}
                placeholder="updated_at"
                className={inputClass()}
                style={inputStyle()}
              />
            </div>
          )}

          {error && <ErrorBox message={error} />}

          <button
            type="button"
            onClick={handleStep2Next}
            disabled={!selectedTable}
            className="w-full h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={primaryBtn(!selectedTable)}
          >
            <ChevronRight size={14} />
            Próximo
          </button>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Mapeie as colunas de <span style={{ color: "#7c5cf8" }}>{selectedTable}</span> para os campos do sistema
          </p>

          {columnsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={14} className="animate-spin" /> Carregando colunas...
            </div>
          )}

          {columnsQuery.isError && (
            <ErrorBox message="Erro ao carregar colunas." />
          )}

          {columnsQuery.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 pr-3" style={{ color: "var(--text-muted)" }}>Coluna externa</th>
                    <th className="text-left py-2 pl-1" style={{ color: "var(--text-muted)" }}>Campo do sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {columnsQuery.data.columns.map((col) => (
                    <ColumnMappingRow
                      key={col.columnName}
                      columnName={col.columnName}
                      dataType={col.dataType}
                      isNullable={col.isNullable}
                      sampleValues={col.sampleValues}
                      value={mapping[col.columnName] ?? ""}
                      onChange={(v) => setMap(col.columnName, v)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {columnsQuery.data && !Object.values(mapping).some((v) => v === "PriceCents") && (
            <WarningBox message="PriceCents não está mapeado — produtos importarão sem preço." />
          )}
          {columnsQuery.data && !Object.values(mapping).some((v) => v === "StockQty") && (
            <WarningBox message="StockQty não está mapeado — produtos importarão sem estoque." />
          )}

          {error && <ErrorBox message={error} />}

          <button
            type="button"
            onClick={handleStep3Next}
            disabled={columnsQuery.isLoading}
            className="w-full h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={primaryBtn(columnsQuery.isLoading)}
          >
            <ChevronRight size={14} />
            Próximo
          </button>
        </div>
      )}

      {/* ── STEP 4 ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Resumo da configuração</p>
            <div className="text-sm space-y-1" style={{ color: "var(--text)" }}>
              <div><span style={{ color: "var(--text-muted)" }}>Fonte: </span>{s1.name}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Banco: </span>{s1.provider} ({s1.mode})</div>
              <div><span style={{ color: "var(--text-muted)" }}>Tabela: </span>{selectedTable}</div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Colunas mapeadas: </span>
                {Object.values(mapping).filter(Boolean).length}
              </div>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <button
            type="button"
            onClick={handleFinalSave}
            disabled={saving}
            className="w-full h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={primaryBtn(saving)}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? "Salvando..." : "Salvar e finalizar"}
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-xs text-red-400 flex items-start gap-2">
      <XCircle size={13} className="shrink-0 mt-0.5" />
      {message}
    </div>
  );
}

function WarningBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-3 text-xs text-yellow-400 flex items-start gap-2">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span><strong>Recomendado:</strong> {message}</span>
    </div>
  );
}
