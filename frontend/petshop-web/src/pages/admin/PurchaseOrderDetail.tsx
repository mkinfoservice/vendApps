import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  getPurchase, addPurchaseItem, removePurchaseItem,
  confirmPurchase, receivePurchase, cancelPurchase,
  type PurchaseOrderDetail, type PurchaseStatus,
} from "@/features/purchases/purchasesApi";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import {
  ArrowLeft, PackageCheck, CheckCircle2, XCircle,
  Plus, Trash2, AlertTriangle,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Confirmed: "bg-blue-100 text-blue-700",
  Received:  "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABELS: Record<PurchaseStatus, string> = {
  Draft: "Rascunho", Confirmed: "Confirmada",
  Received: "Recebida", Cancelled: "Cancelada",
};

// ── product search ─────────────────────────────────────────────────────────────

interface ProductOption { id: string; name: string; barcode: string | null; costCents: number; }

function useProductSearch(query: string) {
  return useQuery<{ items: ProductOption[] }>({
    queryKey: ["product-search", query],
    queryFn: () =>
      adminFetch<{ items: ProductOption[] }>(
        `/admin/products?search=${encodeURIComponent(query)}&pageSize=8&active=true`
      ),
    enabled: query.length >= 2,
  });
}

// ── Add item form ─────────────────────────────────────────────────────────────

function AddItemForm({ purchaseId, onAdded }: { purchaseId: string; onAdded: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [qty, setQty] = useState("1");
  const [costCents, setCostCents] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: results } = useProductSearch(search);

  const mut = useMutation({
    mutationFn: () => addPurchaseItem(purchaseId, {
      productId: selected!.id,
      qty: parseFloat(qty),
      unitCostCents: Math.round(parseFloat(costCents.replace(",", ".")) * 100),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      setSelected(null); setSearch(""); setQty("1"); setCostCents(""); setError(null);
      onAdded();
    },
    onError: (e: Error) => setError(e.message),
  });

  function selectProduct(p: ProductOption) {
    setSelected(p);
    setSearch(p.name);
    setCostCents(p.costCents > 0 ? (p.costCents / 100).toFixed(2) : "");
  }

  const isValid = selected && parseFloat(qty) > 0 && parseFloat(costCents.replace(",", ".")) >= 0;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Adicionar produto</p>

      <div className="relative">
        <input
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
          placeholder="Buscar produto..."
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
        />
        {results?.items && results.items.length > 0 && !selected && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {results.items.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => selectProduct(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
              >
                <span className="font-medium text-gray-900 flex-1">{p.name}</span>
                {p.barcode && <span className="text-xs text-gray-400 font-mono">{p.barcode}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Quantidade</label>
          <input type="number" step="0.001" min="0.001"
            className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
            value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Custo unitário (R$)</label>
          <input type="text" inputMode="decimal"
            className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
            value={costCents} onChange={e => setCostCents(e.target.value)}
            placeholder="0,00" />
        </div>
      </div>

      {selected && parseFloat(qty) > 0 && parseFloat(costCents.replace(",", ".")) >= 0 && (
        <p className="text-xs text-gray-500">
          Total: <span className="font-semibold text-gray-800">
            {fmtCurrency(Math.round(parseFloat(qty) * parseFloat(costCents.replace(",", ".")) * 100))}
          </span>
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        disabled={!isValid || mut.isPending}
        onClick={() => mut.mutate()}
        className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
        {mut.isPending ? "Adicionando..." : "Adicionar"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: po, isLoading } = useQuery<PurchaseOrderDetail>({
    queryKey: ["purchase", id],
    queryFn: () => getPurchase(id!),
    enabled: !!id,
  });

  function makeAction(fn: () => Promise<void>, opts?: { confirm?: string }) {
    return useMutation({
      mutationFn: async () => {
        if (opts?.confirm && !window.confirm(opts.confirm)) return;
        await fn();
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase", id] }),
      onError: (e: Error) => setError(e.message),
    });
  }

  const confirmMut = makeAction(() => confirmPurchase(id!));
  const receiveMut = makeAction(() => receivePurchase(id!));
  const cancelMut  = makeAction(() => cancelPurchase(id!), { confirm: "Cancelar esta ordem de compra?" });

  const removeItemMut = useMutation({
    mutationFn: (itemId: string) => removePurchaseItem(id!, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase", id] }),
  });

  if (isLoading || !po) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-64 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const isDraft     = po.status === "Draft";
  const isConfirmed = po.status === "Confirmed";
  const isReceived  = po.status === "Received";

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      {/* Receive confirmation */}
      {confirmReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-green-700">
              <PackageCheck className="w-6 h-6" />
              <h2 className="font-semibold">Confirmar recebimento</h2>
            </div>
            <p className="text-sm text-gray-600">
              Ao receber, o estoque de <strong>{po.items.length}</strong> produto{po.items.length !== 1 ? "s" : ""} será creditado automaticamente e o custo será atualizado.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmReceive(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button
                disabled={receiveMut.isPending}
                onClick={() => { receiveMut.mutate(); setConfirmReceive(false); }}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
              >
                {receiveMut.isPending ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

        {/* Back + Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate("/admin/purchases")}
            className="mt-1 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{po.supplierName}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                {STATUS_LABELS[po.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {po.invoiceNumber ? `NF ${po.invoiceNumber} · ` : ""}
              Criada em {new Date(po.createdAtUtc).toLocaleDateString("pt-BR")}
              {po.receivedAtUtc && ` · Recebida em ${new Date(po.receivedAtUtc).toLocaleDateString("pt-BR")}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isDraft && (
              <button
                onClick={() => confirmMut.mutate()}
                disabled={confirmMut.isPending || po.items.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:brightness-110 disabled:opacity-40 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar
              </button>
            )}
            {isConfirmed && (
              <button
                onClick={() => setConfirmReceive(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition"
              >
                <PackageCheck className="w-4 h-4" />
                Receber
              </button>
            )}
            {(isDraft || isConfirmed) && (
              <button
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                title="Cancelar ordem"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {po.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
            {po.notes}
          </div>
        )}

        {/* Items table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Itens ({po.items.length})</h2>
            <p className="text-sm font-bold text-gray-900">{fmtCurrency(po.totalCents)}</p>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Custo unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
                {isDraft && <th className="px-4 py-3 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {po.items.length === 0 && (
                <tr>
                  <td colSpan={isDraft ? 5 : 4}
                    className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum item adicionado.
                  </td>
                </tr>
              )}
              {po.items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    {item.barcode && <p className="text-xs text-gray-400 font-mono">{item.barcode}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {item.qty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {fmtCurrency(item.unitCostCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {fmtCurrency(item.totalCents)}
                  </td>
                  {isDraft && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeItemMut.mutate(item.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-red-400 transition"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add item (draft only) */}
        {isDraft && (
          <AddItemForm
            purchaseId={id!}
            onAdded={() => qc.invalidateQueries({ queryKey: ["purchase", id] })}
          />
        )}

        {/* Received info */}
        {isReceived && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <PackageCheck className="w-4 h-4 shrink-0" />
            Estoque creditado em {new Date(po.receivedAtUtc!).toLocaleString("pt-BR")}.
          </div>
        )}

      </div>
    </div>
  );
}
