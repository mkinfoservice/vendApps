import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Draft:     "bg-gray-900/30 text-gray-400",
  Confirmed: "bg-blue-900/30 text-blue-400",
  Received:  "bg-green-900/30 text-green-400",
  Cancelled: "bg-red-900/30 text-red-400",
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
    <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Adicionar produto</p>

      <div className="relative">
        <input
          className="rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          placeholder="Buscar produto..."
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
        />
        {results?.items && results.items.length > 0 && !selected && (
          <div className="absolute z-10 w-full mt-1 rounded-xl shadow-lg overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            {results.items.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => selectProduct(p)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition"
                style={{ color: "var(--text)" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-2)"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""}
              >
                <span className="font-medium flex-1">{p.name}</span>
                {p.barcode && <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{p.barcode}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>Quantidade</label>
          <input type="number" step="0.001" min="0.001"
            className="mt-1 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div>
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>Custo unitário (R$)</label>
          <input type="text" inputMode="decimal"
            className="mt-1 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            value={costCents} onChange={e => setCostCents(e.target.value)}
            placeholder="0,00" />
        </div>
      </div>

      {selected && parseFloat(qty) > 0 && parseFloat(costCents.replace(",", ".")) >= 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Total: <span className="font-semibold" style={{ color: "var(--text)" }}>
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
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 rounded w-48" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-64 rounded-2xl" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        </div>
      </div>
    );
  }

  const isDraft     = po.status === "Draft";
  const isConfirmed = po.status === "Confirmed";
  const isReceived  = po.status === "Received";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>

      {/* Receive confirmation */}
      {confirmReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-green-700">
              <PackageCheck className="w-6 h-6" />
              <h2 className="font-semibold">Confirmar recebimento</h2>
            </div>
            <p className="text-sm text-gray-700">
              Ao receber, o estoque de <strong>{po.items.length}</strong> produto{po.items.length !== 1 ? "s" : ""} será creditado automaticamente e o custo será atualizado.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmReceive(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 hover:bg-gray-100 transition">
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
            onClick={() => navigate("/app/compras")}
            className="mt-1 p-1.5 rounded-lg transition"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-2)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>{po.supplierName}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                {STATUS_LABELS[po.status]}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
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
                className="p-2 rounded-xl border transition hover:bg-red-50 hover:text-red-600"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
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
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Itens ({po.items.length})</h2>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{fmtCurrency(po.totalCents)}</p>
          </div>

          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Produto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Qtd</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Custo unit.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total</th>
                {isDraft && <th className="px-4 py-3 w-12" />}
              </tr>
            </thead>
            <tbody>
              {po.items.length === 0 && (
                <tr>
                  <td colSpan={isDraft ? 5 : 4}
                    className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Nenhum item adicionado.
                  </td>
                </tr>
              )}
              {po.items.map(item => (
                <tr key={item.id} className="transition border-t"
                  style={{ borderColor: "var(--border)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ""}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--text)" }}>{item.productName}</p>
                    {item.barcode && <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{item.barcode}</p>}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: "var(--text)" }}>
                    {item.qty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: "var(--text)" }}>
                    {fmtCurrency(item.unitCostCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
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
