import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  listEntries, getSummary, getCategories, createEntry, updateEntry,
  payEntry, unpayEntry, deleteEntry,
  type FinancialEntryDto, type EntryType, type EntryStatus, type FinancialSummary,
} from "@/features/financial/financialApi";
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw, Loader2, TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(offsetMonths = 0): { from: string; to: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  const from = d.toISOString().slice(0, 10);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to   = last.toISOString().slice(0, 10);
  return { from, to };
}

const STATUS_COLORS: Record<string, string> = {
  paid:    "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  overdue: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Pago", pending: "Pendente", overdue: "Vencido",
};

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: FinancialSummary }) {
  const cards = [
    {
      label: "Receitas pagas",
      value: brl(summary.paidReceitasCents),
      sub: `+ ${brl(summary.pendReceitasCents)} previsto`,
      icon: <TrendingUp size={18} />,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Despesas pagas",
      value: brl(summary.paidDespesasCents),
      sub: `+ ${brl(summary.pendDespesasCents)} previsto`,
      icon: <TrendingDown size={18} />,
      color: "text-red-600 bg-red-50",
    },
    {
      label: "Saldo realizado",
      value: brl(summary.netPaidCents),
      sub: `Previsto: ${brl(summary.netPaidCents + summary.netPendingCents)}`,
      icon: <Wallet size={18} />,
      color: summary.netPaidCents >= 0 ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50",
    },
    {
      label: "Vencidos",
      value: String(summary.overdueCount),
      sub: "sem pagamento",
      icon: <AlertCircle size={18} />,
      color: summary.overdueCount > 0 ? "text-orange-600 bg-orange-50" : "text-gray-400 bg-gray-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
            {c.icon}
          </div>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{c.label}</p>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{c.value}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Entry Modal ───────────────────────────────────────────────────────────────

interface EntryModalProps {
  entry: FinancialEntryDto | null;
  onClose: () => void;
}

function EntryModal({ entry, onClose }: EntryModalProps) {
  const qc = useQueryClient();
  const [type, setType]         = useState<EntryType>(entry?.type ?? "Despesa");
  const [title, setTitle]       = useState(entry?.title ?? "");
  const [amount, setAmount]     = useState(entry ? (entry.amountCents / 100).toFixed(2) : "");
  const [dueDate, setDueDate]   = useState(entry?.dueDate ?? today());
  const [category, setCategory] = useState(entry?.category ?? "");
  const [notes, setNotes]       = useState(entry?.notes ?? "");
  const [error, setError]       = useState<string | null>(null);

  const { data: cats = [] } = useQuery({ queryKey: ["fin-cats"], queryFn: getCategories });

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const ok = title.trim().length > 0 && amountCents > 0 && dueDate.length === 10;

  const mut = useMutation({
    mutationFn: async () => {
      const body = { type, title: title.trim(), amountCents, dueDate, category: category || undefined, notes: notes || undefined };
      return entry ? updateEntry(entry.id, body) : createEntry(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["fin-summary"] });
      qc.invalidateQueries({ queryKey: ["fin-cats"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">{entry ? "Editar Lançamento" : "Novo Lançamento"}</h2>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(["Receita", "Despesa"] as EntryType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                type === t
                  ? t === "Receita" ? "bg-green-600 text-white" : "bg-red-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Descrição *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Pagamento fornecedor XYZ"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Valor (R$) *</label>
              <input
                type="number" min={0} step={0.01}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Vencimento *</label>
              <input
                type="date"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Categoria</label>
            <input
              list="fin-cats-list"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              value={category} onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Aluguel, Salários, Estoque..."
            />
            <datalist id="fin-cats-list">
              {cats.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="text-xs text-gray-500">Observações</label>
            <textarea
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
              rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button
            disabled={!ok || mut.isPending}
            onClick={() => mut.mutate()}
            className="flex-1 py-2 text-sm font-semibold rounded-xl text-white bg-[#7c5cf8] hover:brightness-110 disabled:opacity-40 transition"
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: Array<{ label: string; type?: EntryType; status?: EntryStatus }> = [
  { label: "Todas" },
  { label: "A Receber",  type: "Receita", status: "pending" },
  { label: "A Pagar",    type: "Despesa", status: "pending" },
  { label: "Vencidos",   status: "overdue" },
  { label: "Pagos",      status: "paid" },
];

export default function FinancialEntriesPage() {
  const qc = useQueryClient();
  const [tab, setTab]           = useState(0);
  const [page, setPage]         = useState(1);
  const [from, setFrom]         = useState(monthRange().from);
  const [to, setTo]             = useState(monthRange().to);
  const [editing, setEditing]   = useState<FinancialEntryDto | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<string | null>(null);

  const activeTab = TABS[tab];

  const entriesKey = ["fin-entries", tab, from, to, page];
  const { data, isLoading } = useQuery({
    queryKey: entriesKey,
    queryFn: () => listEntries({
      type: activeTab.type,
      status: activeTab.status,
      from, to, page,
    }),
  });

  const summaryKey = ["fin-summary", from, to];
  const { data: summary } = useQuery({
    queryKey: summaryKey,
    queryFn: () => getSummary(from, to),
  });

  // Reset page when tab/dates change
  useEffect(() => { setPage(1); }, [tab, from, to]);

  const mutPay = useMutation({
    mutationFn: (id: string) => payEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["fin-summary"] });
    },
  });

  const mutUnpay = useMutation({
    mutationFn: (id: string) => unpayEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["fin-summary"] });
    },
  });

  const mutDelete = useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["fin-summary"] });
      setDeleting(null);
    },
  });

  const entries    = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Financeiro</h1>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
          >
            <Plus size={15} /> Lançamento
          </button>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap gap-3 mb-5 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>De</span>
            <input
              type="date"
              className="border rounded-xl px-3 py-1.5 text-sm focus:outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
              value={from} onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Até</span>
            <input
              type="date"
              className="border rounded-xl px-3 py-1.5 text-sm focus:outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
              value={to} onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {/* Quick presets */}
          {[
            { label: "Este mês",  range: monthRange(0) },
            { label: "Mês anterior", range: monthRange(-1) },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setFrom(preset.range.from); setTo(preset.range.to); }}
              className="text-xs px-3 py-1.5 border rounded-xl hover:bg-gray-50 transition"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {summary && <SummaryCards summary={summary} />}

        {/* Category breakdown (mini) */}
        {summary && summary.byCategory.length > 0 && (
          <div className="rounded-2xl border p-4 mb-5 overflow-x-auto" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Por Categoria</p>
            <div className="flex gap-6 min-w-0 flex-wrap">
              {summary.byCategory.slice(0, 8).map((c) => (
                <div key={c.category} className="text-xs min-w-[100px]">
                  <p className="font-medium truncate" style={{ color: "var(--text)" }}>{c.category}</p>
                  {c.receitas > 0 && <p className="text-green-600">+{brl(c.receitas)}</p>}
                  {c.despesas > 0 && <p className="text-red-500">-{brl(c.despesas)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                tab === i
                  ? "border-[#7c5cf8] text-[#7c5cf8]"
                  : "border-transparent hover:text-gray-600"
              }`}
              style={{ color: tab === i ? undefined : "var(--text-muted)" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
        ) : (
          <>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <table className="w-full text-sm">
                <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    <th className="px-5 py-3">Descrição</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Nenhum lançamento no período.</td></tr>
                  )}
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: "var(--border)" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${e.type === "Receita" ? "bg-green-500" : "bg-red-500"}`} />
                          <span className="font-medium truncate max-w-[200px]" style={{ color: "var(--text)" }}>{e.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                        {e.category ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(e.dueDate)}
                        {e.paidDate && <span className="block text-green-600">Pago {fmtDate(e.paidDate)}</span>}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${e.type === "Receita" ? "text-green-700" : "text-red-600"}`}>
                        {e.type === "Receita" ? "+" : "-"}{brl(e.amountCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status]}`}>
                          {STATUS_LABELS[e.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!e.isPaid ? (
                            <button
                              onClick={() => mutPay.mutate(e.id)}
                              className="text-green-600 hover:text-green-700 transition"
                              title="Marcar como pago"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => mutUnpay.mutate(e.id)}
                              className="text-gray-400 hover:text-gray-600 transition"
                              title="Desfazer pagamento"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setEditing(e)}
                            className="text-gray-400 hover:text-gray-600 transition"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleting(e.id)}
                            className="text-gray-300 hover:text-red-500 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
                  ‹ Anterior
                </button>
                <span className="px-3 py-1 text-sm" style={{ color: "var(--text-muted)" }}>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
                  Próxima ›
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {editing !== undefined && (
        <EntryModal entry={editing} onClose={() => setEditing(undefined)} />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs space-y-4">
            <p className="font-semibold text-gray-800">Excluir lançamento?</p>
            <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button
                disabled={mutDelete.isPending}
                onClick={() => mutDelete.mutate(deleting)}
                className="flex-1 py-2 text-sm font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition"
              >
                {mutDelete.isPending ? "..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
