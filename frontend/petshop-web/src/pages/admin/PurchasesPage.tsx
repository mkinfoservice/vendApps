import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listPurchases, listSuppliers, createPurchase,
  type PurchaseStatus,
} from "@/features/purchases/purchasesApi";
import { ShoppingBag, Plus, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  Draft:     "bg-gray-900/30 text-gray-400",
  Confirmed: "bg-blue-900/30 text-blue-400",
  Received:  "bg-green-900/30 text-green-400",
  Cancelled: "bg-red-900/30 text-red-400",
};

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  Draft:     "Rascunho",
  Confirmed: "Confirmada",
  Received:  "Recebida",
  Cancelled: "Cancelada",
};

const ALL_STATUSES: PurchaseStatus[] = ["Draft", "Confirmed", "Received", "Cancelled"];

function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", false],
    queryFn: () => listSuppliers(false),
  });

  const mut = useMutation({
    mutationFn: () => createPurchase({
      supplierId,
      invoiceNumber: invoiceNumber || undefined,
      notes: notes || undefined,
    }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      navigate(`/app/compras/${id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Nova ordem de compra</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fornecedor *</label>
            <select
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nº da NF (opcional)</label>
            <input
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="ex: 001234"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Observações</label>
            <textarea
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 outline-none resize-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancelar</button>
          <button
            disabled={!supplierId || mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
          >
            {mut.isPending ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "">("");
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["purchases", statusFilter, page],
    queryFn: () => listPurchases(page, statusFilter || undefined),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {showNew && <NewOrderModal onClose={() => setShowNew(false)} />}

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(124,92,248,0.12)" }}>
              <ShoppingBag className="w-5 h-5" style={{ color: "#7c5cf8" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Ordens de Compra</h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{total} ordem{total !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            Nova OC
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 rounded-xl p-1 w-fit overflow-x-auto" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap"
            style={statusFilter === "" ? { backgroundColor: "#7c5cf8", color: "#fff" } : { color: "var(--text-muted)" }}
          >
            Todas
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap"
              style={statusFilter === s ? { backgroundColor: "#7c5cf8", color: "#fff" } : { color: "var(--text-muted)" }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fornecedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>NF</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Itens</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>Carregando...</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>Nenhuma ordem de compra encontrada.</td></tr>
              )}
              {items.map(po => (
                <tr
                  key={po.id}
                  onClick={() => navigate(`/app/compras/${po.id}`)}
                  className="transition cursor-pointer border-t"
                  style={{ borderColor: "var(--border)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ""}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{po.supplierName}</td>
                  <td className="px-4 py-3 text-xs hidden sm:table-cell font-mono" style={{ color: "var(--text-muted)" }}>
                    {po.invoiceNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                      {STATUS_LABELS[po.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                    {fmtCurrency(po.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    {po.itemCount} it{po.itemCount !== 1 ? "ens" : "em"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {new Date(po.createdAtUtc).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <span>{total} ordens</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded-lg disabled:opacity-40 transition"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>←</button>
                <span className="px-2">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg disabled:opacity-40 transition"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>→</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
