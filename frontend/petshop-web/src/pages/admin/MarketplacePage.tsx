import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listIntegrations, createIntegration, updateIntegration,
  deactivateIntegration, syncCatalog,
  type MarketplaceIntegrationDto, type UpsertIntegrationRequest,
} from "@/features/marketplace/marketplaceApi";
import {
  Plus, Copy, Check, RefreshCw, Pencil, Trash2,
  AlertCircle, Zap, ShoppingBag, Clock,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s atrás`;
  if (secs < 3600) return `${Math.floor(secs / 60)}min atrás`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h atrás`;
  return `${Math.floor(secs / 86400)}d atrás`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className="p-1 rounded transition-colors"
      style={{ color: copied ? "#22c55e" : "var(--text-muted)" }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--surface-2)" }}
      >
        <ShoppingBag size={28} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="text-center">
        <p className="font-semibold" style={{ color: "var(--text)" }}>
          Nenhuma integração configurada
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Conecte sua loja ao iFood para receber pedidos automaticamente.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg,#C8953A,#A07230)" }}
      >
        <Plus size={15} />
        Conectar iFood
      </button>
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  onEdit,
  onRefresh,
}: {
  integration: MarketplaceIntegrationDto;
  onEdit: (i: MarketplaceIntegrationDto) => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const deactivateMut = useMutation({
    mutationFn: () => deactivateIntegration(integration.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketplace"] }); onRefresh(); },
  });

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await syncCatalog(integration.id);
      setSyncMsg(`✓ ${r.updated} atualizados, ${r.skipped} sem mudança, ${r.failed} falhas${r.notFound.length ? `, ${r.notFound.length} não encontrados no iFood` : ""}`);
    } catch {
      setSyncMsg("Erro ao sincronizar catálogo.");
    } finally {
      setSyncing(false);
    }
  }

  function handleDeactivate() {
    if (!confirm(`Desativar a integração "${integration.displayName}"?`)) return;
    deactivateMut.mutate();
  }

  const baseUrl = window.location.origin.includes("localhost")
    ? "https://vendapps.onrender.com"
    : `${window.location.protocol}//${window.location.hostname.replace(/^[^.]+/, "api")}`;
  const webhookFull = `${baseUrl}${integration.webhookUrl}`;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          {/* iFood logo placeholder */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black"
            style={{ background: "rgba(234,76,0,0.12)", color: "#ea4c00" }}
          >
            iF
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              {integration.displayName}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Merchant ID: {integration.merchantId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              integration.isActive
                ? "bg-green-900/30 text-green-400"
                : "bg-gray-800/60 text-gray-400"
            }`}
          >
            {integration.isActive ? "ativo" : "inativo"}
          </span>
          <button
            onClick={() => onEdit(integration)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDeactivate}
            className="p-1.5 rounded-lg transition-colors text-red-400 hover:text-red-300"
            title="Desativar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
        <div className="px-5 py-3" style={{ background: "var(--surface)" }}>
          <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
            Último pedido
          </p>
          <div className="flex items-center gap-1.5">
            <Clock size={12} style={{ color: "var(--text-muted)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {timeAgo(integration.lastOrderReceivedAtUtc)}
            </span>
          </div>
        </div>
        <div className="px-5 py-3" style={{ background: "var(--surface)" }}>
          <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
            Sync catálogo
          </p>
          <div className="flex items-center gap-1.5">
            <RefreshCw size={12} style={{ color: "var(--text-muted)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {timeAgo(integration.lastCatalogSyncAtUtc)}
            </span>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
          URL do webhook — configure no portal iFood Parceiro
        </p>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
          style={{ background: "var(--surface-2)", color: "var(--text)" }}
        >
          <span className="flex-1 truncate">{webhookFull}</span>
          <CopyButton text={webhookFull} />
        </div>
      </div>

      {/* Config badges */}
      <div className="flex items-center gap-2 px-5 pb-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            integration.autoAcceptOrders ? "bg-blue-900/30 text-blue-400" : "bg-gray-800/40 text-gray-500"
          }`}
        >
          {integration.autoAcceptOrders ? "auto-aceitar" : "aceite manual"}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            integration.autoPrint ? "bg-blue-900/30 text-blue-400" : "bg-gray-800/40 text-gray-500"
          }`}
        >
          {integration.autoPrint ? "auto-imprimir" : "sem impressão"}
        </span>
      </div>

      {/* Error */}
      {integration.lastErrorMessage && (
        <div
          className="mx-4 mb-3 flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}
        >
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{integration.lastErrorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-2 px-5 py-3 border-t"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <button
          onClick={handleSync}
          disabled={syncing || !integration.isActive}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-opacity"
          style={{
            background: "linear-gradient(135deg,#C8953A,#A07230)",
            color: "#fff",
          }}
        >
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          Sync catálogo
        </button>
        {syncMsg && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {syncMsg}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Form modal ────────────────────────────────────────────────────────────────

const EMPTY_FORM: UpsertIntegrationRequest = {
  type: 1, // IFood
  merchantId: "",
  clientId: "",
  clientSecret: "",
  displayName: null,
  webhookSecret: null,
  autoAcceptOrders: true,
  autoPrint: true,
};

function IntegrationModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: MarketplaceIntegrationDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpsertIntegrationRequest>(() =>
    editing
      ? {
          type: 1,
          merchantId: editing.merchantId,
          clientId: editing.clientId,
          clientSecret: "", // não retornado pelo GET
          displayName: editing.displayName,
          webhookSecret: editing.webhookSecret,
          autoAcceptOrders: editing.autoAcceptOrders,
          autoPrint: editing.autoPrint,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof UpsertIntegrationRequest>(
    key: K,
    value: UpsertIntegrationRequest[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateIntegration(editing.id, form);
      } else {
        await createIntegration(form);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto max-h-[90dvh]"
        style={{ background: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black"
              style={{ background: "rgba(234,76,0,0.12)", color: "#ea4c00" }}
            >
              iF
            </div>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>
              {editing ? "Editar integração" : "Conectar iFood"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-lg"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Instructions */}
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            <Zap size={13} className="mt-0.5 shrink-0" style={{ color: "#ea4c00" }} />
            <span>
              Obtenha o <strong>ClientId</strong>, <strong>ClientSecret</strong> e{" "}
              <strong>MerchantId</strong> no portal{" "}
              <strong>iFood Parceiro → Integrações → API</strong>.
            </span>
          </div>

          <Field label="Nome de exibição (opcional)">
            <input
              type="text"
              placeholder="Ex: Loja Centro"
              value={form.displayName ?? ""}
              onChange={(e) => set("displayName", e.target.value || null)}
            />
          </Field>

          <Field label="Merchant ID *">
            <input
              type="text"
              placeholder="UUID da loja no iFood"
              value={form.merchantId}
              onChange={(e) => set("merchantId", e.target.value)}
              required
            />
          </Field>

          <Field label="Client ID *">
            <input
              type="text"
              placeholder="OAuth2 client_id"
              value={form.clientId}
              onChange={(e) => set("clientId", e.target.value)}
              required
            />
          </Field>

          <Field label={editing ? "Client Secret (deixe em branco para manter)" : "Client Secret *"}>
            <input
              type="password"
              placeholder="OAuth2 client_secret"
              value={form.clientSecret}
              onChange={(e) => set("clientSecret", e.target.value)}
              required={!editing}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Toggle
              label="Auto-aceitar pedidos"
              description="Confirma automaticamente ao receber"
              checked={form.autoAcceptOrders}
              onChange={(v) => set("autoAcceptOrders", v)}
            />
            <Toggle
              label="Imprimir automaticamente"
              description="Envia para impressora ao receber"
              checked={form.autoPrint}
              onChange={(v) => set("autoPrint", v)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#C8953A,#A07230)" }}
            >
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Conectar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div
        className="[&>input]:w-full [&>input]:px-3 [&>input]:py-2 [&>input]:rounded-xl [&>input]:text-sm [&>input]:outline-none"
        style={
          {
            "--input-bg": "var(--surface-2)",
            "--input-border": "var(--border)",
            "--input-color": "var(--text)",
          } as React.CSSProperties
        }
      >
        <style>{`
          label input {
            background: var(--surface-2);
            border: 1px solid var(--border);
            color: var(--text);
          }
          label input:focus {
            border-color: #C8953A;
          }
        `}</style>
        {children}
      </div>
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 p-3 rounded-xl text-left border transition-colors"
      style={{
        background: checked ? "rgba(200,149,58,0.08)" : "var(--surface-2)",
        borderColor: checked ? "#C8953A" : "var(--border)",
      }}
    >
      <div
        className="w-8 h-4 rounded-full mt-0.5 shrink-0 flex items-center transition-all"
        style={{
          background: checked ? "#C8953A" : "var(--border)",
          justifyContent: checked ? "flex-end" : "flex-start",
          padding: "2px",
        }}
      >
        <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
          {label}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceIntegrationDto | null>(null);
  const qc = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: listIntegrations,
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(i: MarketplaceIntegrationDto) {
    setEditing(i);
    setModalOpen(true);
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["marketplace"] });
  }

  const active = integrations.filter((i) => i.isActive);
  const inactive = integrations.filter((i) => !i.isActive);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Marketplaces
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Cada integração conecta esta loja a uma conta do iFood.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#C8953A,#A07230)" }}
        >
          <Plus size={15} />
          Nova integração
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-48 rounded-2xl animate-pulse"
              style={{ background: "var(--surface)" }}
            />
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              onEdit={openEdit}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["marketplace"] })}
            />
          ))}
          {inactive.length > 0 && (
            <>
              <p className="text-xs font-semibold mt-2" style={{ color: "var(--text-muted)" }}>
                INATIVAS
              </p>
              {inactive.map((i) => (
                <IntegrationCard
                  key={i.id}
                  integration={i}
                  onEdit={openEdit}
                  onRefresh={() => qc.invalidateQueries({ queryKey: ["marketplace"] })}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <IntegrationModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
