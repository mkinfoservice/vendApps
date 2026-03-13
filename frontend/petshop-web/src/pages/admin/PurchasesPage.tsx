import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  listPurchases, listSuppliers, createPurchase,
  type PurchaseStatus,
} from "@/features/purchases/purchasesApi";
import { ShoppingBag, Plus, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Confirmed: "bg-blue-100 text-blue-700",
  Received:  "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
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
      navigate(`/admin/purchases/${id}`);
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
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
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
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="ex: 001234"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Observações</label>
            <textarea
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none"
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
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      {showNew && <NewOrderModal onClose={() => setShowNew(false)} />}

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ordens de Compra</h1>
              <p className="text-sm text-gray-500">{total} ordem{total !== 1 ? "s" : ""}</p>
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
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit overflow-x-auto">
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              statusFilter === "" ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Todas
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === s ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">NF</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Itens</th>
                <th className="px-4 py-3 text-right">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhuma ordem de compra encontrada.</td></tr>
              )}
              {items.map(po => (
                <tr
                  key={po.id}
                  onClick={() => navigate(`/admin/purchases/${po.id}`)}
                  className="hover:bg-gray-50 transition cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{po.supplierName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell font-mono">
                    {po.invoiceNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                      {STATUS_LABELS[po.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {fmtCurrency(po.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs hidden md:table-cell">
                    {po.itemCount} it{po.itemCount !== 1 ? "ens" : "em"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                    {new Date(po.createdAtUtc).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>{total} ordens</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">←</button>
                <span className="px-2">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">→</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
