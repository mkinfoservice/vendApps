import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  QrCode, Plus, Pencil, Trash2, Copy, Check, X,
  ShoppingBag, BarChart2, Users, ClipboardList, CircleCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  fetchTablesOverview, fetchTableMetrics,
  createTable, updateTable, deleteTable, fetchTableService, finalizeTable, cancelTableOpenOrders,
  type TableOverviewItem,
} from "@/features/admin/tables/api";

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function orderStatusLabel(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "RECEBIDO") return "Recebido";
  if (s === "EM_PREPARO") return "Em preparo";
  if (s === "PRONTO_PARA_ENTREGA") return "Pronto para entrega";
  if (s === "SAIU_PARA_ENTREGA") return "Saiu para entrega";
  if (s === "ENTREGUE") return "Entregue";
  if (s === "CANCELADO") return "Cancelado";
  return status;
}

// ── QR Modal ───────────────────────────────────────────────────────────────────

function QrModal({ table, onClose }: { table: TableOverviewItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const { data: metrics } = useQuery({
    queryKey: ["table-metrics", table.id],
    queryFn: () => fetchTableMetrics(table.id),
  });

  // Gera a URL usando o origin atual (subdomínio da tenant) em vez do qrUrl do backend
  const link = `${window.location.origin}/mesa/${table.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(link)}`;

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-xl w-full max-w-sm"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
              Mesa {table.number}{table.name ? ` — ${table.name}` : ""}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              QR Code para auto-atendimento
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-70"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            <X size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* QR */}
        <div className="flex justify-center px-5 pb-4">
          <div className="p-3 rounded-xl bg-white shadow-sm">
            <img src={qrSrc} alt="QR Code" className="w-[180px] h-[180px]" />
          </div>
        </div>

        {/* Link */}
        <div className="px-5 pb-4">
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
          >
            <span className="flex-1 text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {link}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold transition hover:opacity-70"
              style={{ color: copied ? "#10b981" : "var(--brand)" }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Metrics */}
        {metrics && (
          <div
            className="mx-5 mb-5 rounded-xl border p-3 grid grid-cols-3 gap-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
          >
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Pedidos</p>
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{metrics.completedOrders}</p>
            </div>
            <div className="text-center border-x" style={{ borderColor: "var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Ticket médio</p>
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                {metrics.completedOrders > 0 ? fmtCurrency(metrics.avgTicketCents) : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Receita</p>
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                {metrics.totalRevenueCents > 0 ? fmtCurrency(metrics.totalRevenueCents) : "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table Form Modal ───────────────────────────────────────────────────────────

type FormState = { number: string; name: string; capacity: string };
const EMPTY: FormState = { number: "", name: "", capacity: "4" };

function TableFormModal({
  initial,
  onSave,
  onClose,
  loading,
  error,
}: {
  initial?: TableOverviewItem;
  onSave: (data: FormState) => void;
  onClose: () => void;
  loading: boolean;
  error?: string;
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? { number: String(initial.number), name: initial.name ?? "", capacity: String(initial.capacity) }
      : EMPTY,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-xl w-full max-w-sm p-5 space-y-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
            {initial ? "Editar mesa" : "Nova mesa"}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--surface-2)" }}>
            <X size={13} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Número *</label>
            <input
              type="number"
              min={1}
              value={form.number}
              onChange={(e) => setForm(f => ({ ...f, number: e.target.value }))}
              className="w-full h-10 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Capacidade</label>
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm(f => ({ ...f, capacity: e.target.value }))}
              className="w-full h-10 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Nome amigável (opcional)</label>
          <input
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Varanda, Vip 1..."
            className="w-full h-10 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={() => onSave(form)}
          disabled={loading || !form.number}
          className="w-full h-10 rounded-xl font-semibold text-sm text-white disabled:opacity-50 transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
        >
          {loading ? "Salvando…" : (initial ? "Salvar alterações" : "Criar mesa")}
        </button>
      </div>
    </div>
  );
}

function ServiceModal({
  table,
  onClose,
}: {
  table: TableOverviewItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [hostName, setHostName] = useState("");
  const [guests, setGuests] = useState("1");

  const serviceQ = useQuery({
    queryKey: ["table-service", table.id],
    queryFn: () => fetchTableService(table.id),
    refetchInterval: 5000,
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeTable(table.id),
    onSuccess: (res) => {
      alert(res.message);
      qc.invalidateQueries({ queryKey: ["tables-overview"] });
      qc.invalidateQueries({ queryKey: ["table-service", table.id] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelTableOpenOrders(table.id),
    onSuccess: (res) => {
      alert(res.message);
      qc.invalidateQueries({ queryKey: ["tables-overview"] });
      qc.invalidateQueries({ queryKey: ["table-service", table.id] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const service = serviceQ.data;
  const maxGuests = table.capacity > 0 ? table.capacity : 1;
  const safeGuests = Math.min(Math.max(parseInt(guests || "1"), 1), maxGuests);

  function handleOpenComanda() {
    const qs = new URLSearchParams();
    qs.set("guests", String(safeGuests));
    if (hostName.trim()) qs.set("host", hostName.trim());
    const url = `/mesa/${table.id}?${qs.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--text)" }}>
              Mesa {table.number}{table.name ? ` - ${table.name}` : ""}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Gerencie a comanda e libere a mesa quando o atendimento terminar.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--surface-2)" }}>
            <X size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-72px)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Capacidade</p>
              <p className="text-lg font-black" style={{ color: "var(--text)" }}>{table.capacity}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Pedidos ativos</p>
              <p className="text-lg font-black" style={{ color: "var(--text)" }}>{service?.totals.orders ?? 0}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Valor em aberto</p>
              <p className="text-lg font-black" style={{ color: "var(--text)" }}>{fmtCurrency(service?.totals.amountCents ?? 0)}</p>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <div className="flex items-center gap-2">
              <ClipboardList size={14} style={{ color: "var(--brand)" }} />
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Abrir comanda para atendimento rapido</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Nome do responsavel</label>
                <input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Ex: Joao"
                  className="w-full h-10 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                  Pessoas (max {maxGuests})
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxGuests}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full h-10 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                />
              </div>
            </div>
            <button
              onClick={handleOpenComanda}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
            >
              Abrir comanda da mesa
            </button>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-2 border-b text-xs font-bold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Pedidos da mesa
            </div>
            <div className="max-h-56 overflow-y-auto">
              {serviceQ.isLoading ? (
                <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>Carregando pedidos...</div>
              ) : (service?.activeOrders.length ?? 0) === 0 ? (
                <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma comanda ativa nesta mesa.</div>
              ) : (
                service!.activeOrders.map((o) => (
                  <div key={o.id} className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{o.publicId}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {o.customerName} - {orderStatusLabel(o.status)}
                      </p>
                    </div>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{fmtCurrency(o.totalCents)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (!confirm("Cancelar todas as comandas abertas desta mesa?")) return;
                cancelMut.mutate();
              }}
              disabled={cancelMut.isPending}
              className="h-11 rounded-xl text-sm font-semibold border transition disabled:opacity-60"
              style={{ borderColor: "#fca5a5", color: "#dc2626", backgroundColor: "#fff1f2" }}
            >
              {cancelMut.isPending ? "Cancelando..." : "Cancelar comanda"}
            </button>
            <button
              onClick={() => {
                if (!confirm("Finalizar mesa e liberar para reuso? Pedidos PRONTO serao marcados como ENTREGUE.")) return;
                finalizeMut.mutate();
              }}
              disabled={finalizeMut.isPending}
              className="h-11 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              <CircleCheck size={15} />
              {finalizeMut.isPending ? "Finalizando..." : "Finalizar mesa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Table Card ─────────────────────────────────────────────────────────────────

function TableCard({
  table,
  onManage,
  onQr,
  onEdit,
  onDelete,
}: {
  table: TableOverviewItem;
  onManage: () => void;
  onQr: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasOpenOrders = table.openOrders > 0;
  const statusColor   = !table.isActive ? "#94a3b8" : hasOpenOrders ? "#f59e0b" : "#10b981";
  const statusLabel   = !table.isActive ? "Inativa" : hasOpenOrders ? "Ocupada" : "Livre";
  const statusBg      = !table.isActive ? "rgba(148,163,184,0.12)" : hasOpenOrders ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)";

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:shadow-md cursor-pointer"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      onClick={onManage}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black" style={{ color: "var(--text)" }}>
              {table.number}
            </span>
            {table.name && (
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {table.name}
              </span>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1"
            style={{ backgroundColor: statusBg, color: statusColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:opacity-70"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            <Pencil size={12} style={{ color: "var(--text-muted)" }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:opacity-70"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            <Trash2 size={12} style={{ color: "#ef4444" }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <Users size={11} />
          {table.capacity} lugares
        </span>
        {hasOpenOrders && (
          <span className="flex items-center gap-1" style={{ color: "#f59e0b" }}>
            <ShoppingBag size={11} />
            {table.openOrders} pedido{table.openOrders > 1 ? "s" : ""} aberto{table.openOrders > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* QR Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onQr(); }}
        className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)", color: "#fff" }}
      >
        <QrCode size={13} />
        Ver QR Code
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const qc = useQueryClient();
  const [qrTable,   setQrTable]   = useState<TableOverviewItem | null>(null);
  const [serviceTable, setServiceTable] = useState<TableOverviewItem | null>(null);
  const [editTable, setEditTable] = useState<TableOverviewItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [mutErr,    setMutErr]    = useState<string | undefined>();

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["tables-overview"],
    queryFn: fetchTablesOverview,
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      createTable({
        number:   parseInt(f.number),
        name:     f.name.trim() || undefined,
        capacity: parseInt(f.capacity) || 4,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables-overview"] });
      setShowCreate(false);
      setMutErr(undefined);
    },
    onError: (e: Error) => setMutErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      updateTable(id, {
        number:   parseInt(f.number),
        name:     f.name.trim() || undefined,
        capacity: parseInt(f.capacity) || 4,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables-overview"] });
      setEditTable(null);
      setMutErr(undefined);
    },
    onError: (e: Error) => setMutErr(e.message),
  });

  async function handleDelete(table: TableOverviewItem) {
    if (!confirm(`Excluir Mesa ${table.number}${table.name ? ` — ${table.name}` : ""}?`)) return;
    try {
      await deleteTable(table.id);
      qc.invalidateQueries({ queryKey: ["tables-overview"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  async function handleToggleActive(table: TableOverviewItem) {
    await updateTable(table.id, { isActive: !table.isActive });
    qc.invalidateQueries({ queryKey: ["tables-overview"] });
  }

  const active   = tables.filter(t => t.isActive);
  const occupied = active.filter(t => t.openOrders > 0).length;
  const free     = active.length - occupied;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        <PageHeader
          title="Mesas"
          subtitle={
            isLoading
              ? "Carregando..."
              : `${active.length} ativa${active.length !== 1 ? "s" : ""} · ${occupied} ocupada${occupied !== 1 ? "s" : ""} · ${free} livre${free !== 1 ? "s" : ""}`
          }
          actions={
            <button
              type="button"
              onClick={() => { setShowCreate(true); setMutErr(undefined); }}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
            >
              <Plus size={15} />
              Nova mesa
            </button>
          }
        />

        {/* Summary bar */}
        {!isLoading && tables.length > 0 && (
          <div
            className="rounded-2xl border p-4 mb-6 grid grid-cols-3 gap-4"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color: "#10b981" }}>{free}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>Livres</p>
            </div>
            <div className="text-center border-x" style={{ borderColor: "var(--border)" }}>
              <p className="text-2xl font-black" style={{ color: "#f59e0b" }}>{occupied}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>Ocupadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color: "var(--text)" }}>{active.length}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>Total ativas</p>
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border h-44 animate-pulse" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }} />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <BarChart2 className="mx-auto mb-3 opacity-30" size={40} style={{ color: "var(--text-muted)" }} />
            <p className="font-semibold" style={{ color: "var(--text)" }}>Nenhuma mesa cadastrada</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Crie mesas para usar o auto-atendimento via QR Code.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
            >
              <Plus size={14} /> Criar primeira mesa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {tables.map((t) => (
              <TableCard
                key={t.id}
                table={t}
                onManage={() => setServiceTable(t)}
                onQr={() => setQrTable(t)}
                onEdit={() => { setEditTable(t); setMutErr(undefined); }}
                onDelete={() => handleDelete(t)}
              />
            ))}
          </div>
        )}

        {/* Inactive tables */}
        {tables.some(t => !t.isActive) && (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Inativas
            </p>
            <div className="flex flex-wrap gap-2">
              {tables.filter(t => !t.isActive).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleToggleActive(t)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium border transition hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--surface)" }}
                >
                  Mesa {t.number}{t.name ? ` — ${t.name}` : ""} · Reativar
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {qrTable && <QrModal table={qrTable} onClose={() => setQrTable(null)} />}
      {serviceTable && <ServiceModal table={serviceTable} onClose={() => setServiceTable(null)} />}

      {showCreate && (
        <TableFormModal
          onSave={(f) => createMut.mutate(f)}
          onClose={() => { setShowCreate(false); setMutErr(undefined); }}
          loading={createMut.isPending}
          error={mutErr}
        />
      )}

      {editTable && (
        <TableFormModal
          initial={editTable}
          onSave={(f) => updateMut.mutate({ id: editTable.id, f })}
          onClose={() => { setEditTable(null); setMutErr(undefined); }}
          loading={updateMut.isPending}
          error={mutErr}
        />
      )}
    </div>
  );
}
