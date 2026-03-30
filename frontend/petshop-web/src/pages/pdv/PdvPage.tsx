import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { usePdv } from "@/features/pdv/PdvContext";
import {
  createSale, scanBarcode, removeItem, paySale, cancelSale,
  closeSession, getCupom, getSessionReport, addMovement, importDav, addItem,
  type Sale, type CupomData, type SessionReport,
} from "@/features/pdv/api";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import OpenSessionPage from "./OpenSessionPage";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const payMethodLabel = (m: string): string =>
  ({ PIX: "PIX", DINHEIRO: "Dinheiro", CARTAO_CREDITO: "CartÃ£o CrÃ©dito",
     CARTAO_DEBITO: "CartÃ£o DÃ©bito", CHEQUE: "Cheque" }[m] ?? m);

// â”€â”€ Cupom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function printCupom(data: CupomData) {
  const itemRows = data.items.map((i) => {
    const qtyLabel = i.isSoldByWeight ? `${i.weightKg?.toFixed(3)} kg` : `${i.qty}x`;
    return `
      <tr><td colspan="3" style="font-size:11px;font-weight:600;padding-top:4px">${i.productNameSnapshot}</td></tr>
      <tr style="color:#555">
        <td style="font-size:11px">${qtyLabel}</td>
        <td style="font-size:11px;text-align:right">${brl(i.unitPriceCentsSnapshot)}</td>
        <td style="font-size:11px;text-align:right;font-weight:bold;color:#111">${brl(i.totalCents)}</td>
      </tr>
      <tr><td colspan="3"><hr style="border:none;border-top:1px dashed #ddd;margin:2px 0"></td></tr>`;
  }).join("");

  const payRows = data.payments.map((p) =>
    `<tr>
      <td style="font-size:11px">${payMethodLabel(p.paymentMethod)}</td>
      <td style="font-size:11px;text-align:right;font-weight:600">${brl(p.amountCents)}</td>
      ${p.changeCents > 0 ? `<td style="font-size:10px;text-align:right;color:#555">troco ${brl(p.changeCents)}</td>` : "<td></td>"}
    </tr>`
  ).join("");

  const contingNote = data.fiscalDecision === "PermanentContingency"
    ? `<p style="font-size:9px;color:#c00;text-align:center;margin-top:4px">âš  VENDA EM CONTINGÃŠNCIA â€” NFC-e nÃ£o emitida</p>` : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:6px 8px 10px}
  .co{font-size:14px;font-weight:bold;text-align:center;letter-spacing:.5px}
  .sub{font-size:10px;text-align:center;color:#555;margin-bottom:2px}
  .sep-solid{border:none;border-top:2px solid #000;margin:5px 0}
  .sep-dash{border:none;border-top:1px dashed #aaa;margin:5px 0}
  table{width:100%;border-collapse:collapse}
  .total-row td{font-size:14px;font-weight:bold;padding-top:3px}
  .thanks{font-size:10px;text-align:center;color:#555;margin-top:6px}
  @media print{@page{margin:0}body{padding:3px}}
</style>
</head><body>
<p class="co">${data.companyName}</p>
<p class="sub">CUPOM NÃƒO FISCAL</p>
<p class="sub">${data.publicId}</p>
<p class="sub">${new Date(data.createdAtUtc).toLocaleString("pt-BR")}</p>
${data.customerName ? `<p class="sub">Cliente: ${data.customerName}</p>` : ""}
<hr class="sep-solid">
<table><tbody>${itemRows}</tbody></table>
<hr class="sep-solid">
<table>
  ${data.discountCents > 0 ? `<tr><td style="font-size:11px">Subtotal</td><td style="font-size:11px;text-align:right">${brl(data.subtotalCents)}</td><td></td></tr>
  <tr><td style="font-size:11px">Desconto</td><td style="font-size:11px;text-align:right;color:#c00">-${brl(data.discountCents)}</td><td></td></tr>` : ""}
  <tr class="total-row">
    <td>TOTAL</td><td style="text-align:right">${brl(data.totalCents)}</td><td></td>
  </tr>
</table>
<hr class="sep-dash">
<table><tbody>${payRows}</tbody></table>
${contingNote}
<p class="thanks">Obrigado pela preferÃªncia!</p>
</body></html>`;

  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// â”€â”€ Movement Modal (Sangria / Suprimento) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface MovementModalProps {
  sessionId: string;
  defaultType: "Sangria" | "Suprimento";
  onClose: () => void;
}

function MovementModal({ sessionId, defaultType, onClose }: MovementModalProps) {
  const [type, setType]       = useState<"Sangria" | "Suprimento">(defaultType);
  const [amount, setAmount]   = useState("");
  const [desc, setDesc]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const ok = amountCents > 0;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await addMovement(sessionId, { type, amountCents, description: desc });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao registrar movimento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Movimento de Caixa</h2>

        <div className="flex gap-2">
          {(["Sangria", "Suprimento"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                type === t
                  ? t === "Sangria"
                    ? "bg-red-500 text-white"
                    : "bg-green-600 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Valor (R$)</label>
            <input
              type="number" min={0} step={0.01} autoFocus
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">DescriÃ§Ã£o (opcional)</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={type === "Sangria" ? "Ex: Recolhimento parcial" : "Ex: ReforÃ§o de troco"}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button
            disabled={!ok || loading}
            onClick={handleSubmit}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl text-white transition disabled:opacity-40 ${
              type === "Sangria" ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Close Session Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface CloseModalProps {
  sessionId: string;
  onClose: () => void;
  onConfirmed: () => void;
}

function CloseSessionModal({ sessionId, onClose, onConfirmed }: CloseModalProps) {
  const [report, setReport]         = useState<SessionReport | null>(null);
  const [loadingRpt, setLoadingRpt] = useState(true);
  const [closing, setClosing]       = useState("");
  const [notes, setNotes]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    getSessionReport(sessionId)
      .then((r) => setReport(r as SessionReport))
      .finally(() => setLoadingRpt(false));
  }, [sessionId]);

  const closingCents = Math.round(parseFloat(closing || "0") * 100);
  const expectedCash = report?.expectedCashCents ?? 0;
  const divergence   = closingCents - expectedCash;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await closeSession(sessionId, { closingBalanceCents: closingCents, notes });
      onConfirmed();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao fechar caixa");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-800">Fechamento de Caixa</h2>

        {loadingRpt ? (
          <p className="text-center text-gray-400 py-8">Carregando...</p>
        ) : report && (
          <>
            {/* Resumo vendas */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Resumo de Vendas</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{report.totalSalesCount} venda(s)</span>
                <span className="font-semibold">{brl(report.totalSalesCents)}</span>
              </div>
              {report.byPaymentMethod.map((b) => (
                <div key={b.paymentMethod} className="flex justify-between text-sm text-gray-500">
                  <span>{payMethodLabel(b.paymentMethod)}</span>
                  <span>{brl(b.totalCents)}</span>
                </div>
              ))}
              {report.cancelledSalesCount > 0 && (
                <p className="text-xs text-red-400">{report.cancelledSalesCount} venda(s) cancelada(s)</p>
              )}
            </div>

            {/* Movimentos */}
            {(report.totalSangriaCents > 0 || report.totalSuprimentoCents > 0) && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Movimentos</p>
                {report.totalSuprimentoCents > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Suprimentos</span>
                    <span>+{brl(report.totalSuprimentoCents)}</span>
                  </div>
                )}
                {report.totalSangriaCents > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Sangrias</span>
                    <span>-{brl(report.totalSangriaCents)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ConferÃªncia */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">ConferÃªncia de Caixa</p>
              <div className="flex justify-between text-sm bg-blue-50 rounded-xl px-4 py-3">
                <span className="text-blue-700">Saldo esperado</span>
                <span className="font-semibold text-blue-800">{brl(expectedCash)}</span>
              </div>
              <div>
                <label className="text-xs text-gray-500">Contagem fÃ­sica (R$)</label>
                <input
                  type="number" min={0} step={0.01}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
                  value={closing}
                  onChange={(e) => setClosing(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              {closing !== "" && (
                <div className={`flex justify-between text-sm rounded-xl px-4 py-3 ${
                  divergence === 0 ? "bg-green-50 text-green-700"
                  : divergence > 0 ? "bg-yellow-50 text-yellow-700"
                  : "bg-red-50 text-red-700"
                }`}>
                  <span>DivergÃªncia</span>
                  <span className="font-semibold">
                    {divergence > 0 ? "+" : ""}{brl(divergence)}
                  </span>
                </div>
              )}
            </div>

            {/* ObservaÃ§Ãµes */}
            <div>
              <label className="text-xs text-gray-500">ObservaÃ§Ãµes (opcional)</label>
              <textarea
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button
            disabled={loadingRpt || submitting}
            onClick={handleConfirm}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition"
          >
            {submitting ? "Fechando..." : "Fechar Caixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Payment Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PayMethod = { method: string; label: string; color: string };

const PAY_METHODS: PayMethod[] = [
  { method: "PIX",            label: "PIX",           color: "#00bfa5" },
  { method: "DINHEIRO",       label: "Dinheiro",       color: "#43a047" },
  { method: "CARTAO_CREDITO", label: "CrÃ©dito",        color: "#1e88e5" },
  { method: "CARTAO_DEBITO",  label: "DÃ©bito",         color: "#5e35b1" },
];

interface PayPanelProps {
  totalCents: number;
  onPay: (method: string, amountCents: number) => void;
  onCancel: () => void;
  paying: boolean;
}

function PayPanel({ totalCents, onPay, onCancel, paying }: PayPanelProps) {
  const [cash, setCash] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-center text-2xl font-bold text-gray-800">{brl(totalCents)}</p>

      <div className="grid grid-cols-2 gap-3">
        {PAY_METHODS.map((pm) => (
          <button
            key={pm.method}
            disabled={paying}
            onClick={() => onPay(pm.method, totalCents)}
            className="py-3 rounded-xl text-white font-semibold text-sm transition active:scale-95"
            style={{ background: pm.color }}
          >
            {pm.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="number"
          placeholder="Dinheiro recebido (R$)"
          className="flex-1 border rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
        />
        <button
          disabled={paying || !cash}
          onClick={() => onPay("DINHEIRO", Math.round(parseFloat(cash || "0") * 100))}
          className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium"
        >
          Confirmar
        </button>
      </div>

      <button
        onClick={onCancel}
        disabled={paying}
        className="w-full py-2 rounded-xl border border-red-300 text-red-500 text-sm"
      >
        Cancelar venda
      </button>
    </div>
  );
}

// â”€â”€ DAV Search Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DavSummary { id: string; publicId: string; customerName: string; totalCents: number; itemCount: number; status: string; }

function DavSearchModal({ onSelect, onClose }: { onSelect: (code: string) => void; onClose: () => void }) {
  const [q, setQ]               = useState("");
  const [results, setResults]   = useState<DavSummary[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    setLoading(true);
    adminFetch<{ items: DavSummary[] }>(`/admin/dav?origin=Manual&pageSize=100&from=${from.toISOString()}`)
      .then((r) => setResults(r.items.filter((d) => d.status !== "Converted" && d.status !== "Cancelled")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filtered = q.trim()
    ? results.filter((d) => d.publicId.toLowerCase().includes(q.toLowerCase()) || d.customerName?.toLowerCase().includes(q.toLowerCase()))
    : results;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-3 pb-3 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Buscar OrÃ§amento (DAV)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="CÃ³digo ou nome do clienteâ€¦"
              className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {loading && <p className="text-center py-6 text-sm text-gray-400">Carregandoâ€¦</p>}
          {!loading && filtered.length === 0 && <p className="text-center py-6 text-sm text-gray-400">Nenhum orÃ§amento encontrado.</p>}
          {filtered.map((d) => (
            <button key={d.id} type="button"
              onClick={() => { onSelect(d.publicId); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-left transition"
            >
              <div>
                <p className="text-sm font-semibold text-emerald-700">{d.publicId}</p>
                <p className="text-xs text-gray-400">{d.customerName || "â€”"} Â· {d.itemCount} item{d.itemCount !== 1 ? "s" : ""}</p>
              </div>
              <p className="text-sm font-bold text-gray-700">{fmt(d.totalCents)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Quick Products (atalhos no estado vazio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface QuickProduct {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  hasAddons: boolean;
  isBestSeller?: boolean;
  barcode?: string | null;
  internalCode?: string | null;
}

interface AddonOption {
  id: string;
  name: string;
  priceCents: number;
}

function AddonModal({
  product,
  saleId,
  onConfirm,
  onClose,
}: {
  product: QuickProduct;
  saleId: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [addons, setAddons]           = useState<AddonOption[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);

  useEffect(() => {
    adminFetch<AddonOption[]>(`/admin/products/${product.id}/addons`)
      .then(setAddons)
      .catch(() => setAddons([]))
      .finally(() => setLoading(false));
  }, [product.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const extraCents = addons
    .filter((a) => selected.has(a.id))
    .reduce((s, a) => s + a.priceCents, 0);

  async function handleConfirm(addonIds: string[]) {
    setAdding(true);
    try {
      await addItem(saleId, { productId: product.id, qty: 1, addonIds: addonIds.length ? addonIds : undefined });
      onConfirm(product.name);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div>
          <h2 className="font-bold text-gray-800 text-base">{product.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Escolha os adicionais</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Carregando...</p>
        ) : addons.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nenhum adicional disponÃ­vel.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {addons.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left"
                style={{
                  borderColor: selected.has(a.id) ? "#7c5cf8" : "#e5e7eb",
                  backgroundColor: selected.has(a.id) ? "rgba(124,92,248,0.06)" : "transparent",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    borderColor: selected.has(a.id) ? "#7c5cf8" : "#d1d5db",
                    backgroundColor: selected.has(a.id) ? "#7c5cf8" : "transparent",
                  }}
                >
                  {selected.has(a.id) && <span className="text-white text-[10px] font-bold">âœ“</span>}
                </div>
                <span className="flex-1 text-sm text-gray-700 font-medium">{a.name}</span>
                <span className="text-sm font-bold text-[#7c5cf8]">+{brl(a.priceCents)}</span>
              </button>
            ))}
          </div>
        )}

        {extraCents > 0 && (
          <div className="flex justify-between text-sm px-1">
            <span className="text-gray-500">Total com adicionais</span>
            <span className="font-bold text-gray-800">{brl(product.priceCents + extraCents)}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleConfirm([])}
            disabled={adding}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
          >
            NÃ£o, obrigado
          </button>
          <button
            type="button"
            disabled={adding || loading}
            onClick={() => handleConfirm([...selected])}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          >
            {adding ? "Adicionando..." : selected.size > 0 ? `Adicionar (${selected.size})` : "Adicionar"}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
          style={{ position: "absolute" }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function QuickProducts({
  saleId,
  onAdded,
}: {
  saleId: string;
  onAdded: (name: string) => void;
}) {
  const [products, setProducts]   = useState<QuickProduct[]>([]);
  const [loading, setLoading]     = useState(false);
  const [adding, setAdding]       = useState<string | null>(null);
  const [addonTarget, setAddonTarget] = useState<QuickProduct | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAllProducts() {
      setLoading(true);
      try {
        const pageSize = 200;
        let page = 1;
        let all: QuickProduct[] = [];
        let total = 0;
        do {
          const p = new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
            active: "true",
          });
          if (search.trim()) p.set("search", search.trim());

          const r = await adminFetch<{ total: number; items: QuickProduct[] }>(`/admin/products?${p.toString()}`);
          total = r.total ?? 0;
          all = all.concat(r.items ?? []);
          page += 1;
        } while (all.length < total && page <= 10);

        all.sort((a, b) => {
          const bestA = a.isBestSeller ? 1 : 0;
          const bestB = b.isBestSeller ? 1 : 0;
          if (bestA !== bestB) return bestB - bestA;
          return a.name.localeCompare(b.name, "pt-BR");
        });

        if (!cancelled) setProducts(all);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAllProducts();
    return () => { cancelled = true; };
  }, [search]);

  async function handleAdd(p: QuickProduct) {
    if (adding) return;
    if (p.hasAddons) {
      setAddonTarget(p);
      return;
    }
    setAdding(p.id);
    try {
      await addItem(saleId, { productId: p.id, qty: 1 });
      onAdded(p.name);
    } finally {
      setAdding(null);
    }
  }

  if (loading) {
    return (
      <div className="h-full min-h-[240px] flex items-center justify-center text-gray-400 text-sm">
        Carregando catÃ¡logo...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="h-full min-h-[240px] flex items-center justify-center text-gray-300 text-sm">
        Nenhum produto encontrado
      </div>
    );
  }

  return (
    <>
      {addonTarget && (
        <AddonModal
          product={addonTarget}
          saleId={saleId}
          onConfirm={(name) => { setAddonTarget(null); onAdded(name); }}
          onClose={() => setAddonTarget(null)}
        />
      )}
      <div className="h-full overflow-y-auto p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cÃ³digo interno ou cÃ³digo de barras"
              className="w-full h-9 rounded-lg border border-gray-200 pl-8 pr-3 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/20"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={adding === p.id || !saleId}
              onClick={() => handleAdd(p)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl border bg-white hover:border-[#7c5cf8] hover:shadow-sm transition active:scale-95 text-left disabled:opacity-50 relative"
              style={{ borderColor: p.isBestSeller ? "rgba(245,158,11,0.45)" : "#f3f4f6" }}
            >
              {p.isBestSeller && (
                <span className="absolute top-1 left-1 text-[8px] font-bold text-white rounded-full px-1.5 py-px leading-none" style={{ background: "#f59e0b" }}>
                  Mais vendido
                </span>
              )}
              {p.hasAddons && (
                <span className="absolute top-1 right-1 text-[8px] font-bold text-white rounded-full px-1 py-px leading-none" style={{ background: "#7c5cf8" }}>+</span>
              )}
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-200">ðŸ“¦</span>
                )}
              </div>
              <span className="text-[11px] text-gray-700 font-medium leading-tight text-center line-clamp-2 w-full">
                {p.name}
              </span>
              <span className="text-[11px] font-bold text-[#7c5cf8]">
                {brl(p.priceCents)}
              </span>
              {(p.internalCode || p.barcode) && (
                <span className="text-[10px] text-gray-400 leading-tight text-center">
                  {p.internalCode || p.barcode}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function CartTable({
  sale,
  onRemove,
}: {
  sale: Sale | null;
  onRemove: (itemId: string) => void;
}) {
  return (
    <div className="overflow-y-auto h-full">
      <table className="w-full text-sm text-gray-900">
        <thead className="border-b sticky top-0 bg-white z-10">
          <tr className="text-left text-xs text-gray-400">
            <th className="px-4 py-3">Produto</th>
            <th className="px-3 py-3 text-right hidden sm:table-cell">Qtd</th>
            <th className="px-3 py-3 text-right hidden sm:table-cell">Unit</th>
            <th className="px-3 py-3 text-right">Total</th>
            <th className="px-3 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {!sale || sale.items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                Nenhum item no carrinho
              </td>
            </tr>
          ) : sale.items.map((item) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-900">
                <span className="block truncate max-w-[180px] sm:max-w-xs md:max-w-none">{item.productNameSnapshot}</span>
                <span className="sm:hidden text-xs text-gray-400 mt-0.5">
                  {item.isSoldByWeight ? `${item.weightKg?.toFixed(3)} kg` : `${item.qty}x`} Â· {brl(item.unitPriceCentsSnapshot)}
                </span>
                {item.addons && item.addons.length > 0 && (
                  <span className="block mt-1 text-[11px] text-[#7c5cf8]">
                    + {item.addons.map((a) => a.nameSnapshot).join(", ")}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                {item.isSoldByWeight ? `${item.weightKg?.toFixed(3)} kg` : item.qty}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                {brl(item.unitPriceCentsSnapshot)}
                {item.isSoldByWeight && <span className="text-xs">/kg</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{brl(item.totalCents)}</td>
              <td className="px-3 py-2.5">
                <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-sm leading-none">
                  âœ•
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€ Main PDV Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PdvPage() {
  const { session, sale, loading, refreshSession, refreshSale, setSale } = usePdv();

  const [initialized, setInitialized]       = useState(false);
  const [barcode, setBarcode]               = useState("");
  const [scanning, setScanning]             = useState(false);
  const [davCode, setDavCode]               = useState("");
  const [importingDav, setImportingDav]     = useState(false);
  const [showDavSearch, setShowDavSearch]   = useState(false);
  const [paying, setPaying]                 = useState(false);
  const [showPay, setShowPay]               = useState(false);
  const [feedback, setFeedback]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [movementType, setMovementType]     = useState<"Sangria" | "Suprimento" | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshSession().then(() => setInitialized(true));
  }, [refreshSession]);

  useEffect(() => {
    if (session && !sale) {
      handleNewSale();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const flash = useCallback((msg: string, ok: boolean) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 2500);
  }, []);

  async function handleNewSale() {
    if (!session) return;
    try {
      const created = await createSale({ cashSessionId: session.id });
      await refreshSale(created.id);
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "Erro ao criar venda", false);
    }
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!sale || !barcode.trim()) return;
    setScanning(true);
    try {
      const res = await scanBarcode(sale.id, barcode.trim());
      await refreshSale(sale.id);
      flash(`${res.productNameSnapshot} adicionado`, true);
      setBarcode("");
      barcodeRef.current?.focus();
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "Produto nÃ£o encontrado", false);
    } finally {
      setScanning(false);
    }
  }

  async function handleImportDav(e: React.FormEvent) {
    e.preventDefault();
    if (!sale || !davCode.trim()) return;
    setImportingDav(true);
    // Accept "DAV-XXXX" or just "XXXX" â€” backend stores with DAV- prefix
    const code = davCode.trim().toUpperCase().startsWith("DAV-")
      ? davCode.trim().toUpperCase()
      : `DAV-${davCode.trim().toUpperCase()}`;
    try {
      const res = await importDav(sale.id, code);
      await refreshSale(sale.id);
      flash(`DAV ${res.publicId} importado (${res.itemsAdded} item${res.itemsAdded !== 1 ? "s" : ""})`, true);
      setDavCode("");
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "DAV nÃ£o encontrado", false);
    } finally {
      setImportingDav(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!sale) return;
    await removeItem(sale.id, itemId);
    await refreshSale(sale.id);
  }

  async function handlePay(method: string, amountCents: number) {
    if (!sale) return;
    if (amountCents < sale.totalCents) {
      flash(`Valor insuficiente. Total: ${brl(sale.totalCents)}`, false);
      return;
    }
    setPaying(true);
    try {
      const result = await paySale(sale.id, {
        payments: [{ paymentMethod: method, amountCents }],
      });
      const cupomData = await getCupom(sale.id);
      printCupom(cupomData);
      flash(`Venda finalizada! ${brl(result.totalCents)}`, true);
      if (result.changeCents > 0) {
        flash(`Troco: ${brl(result.changeCents)}`, true);
      }
      setShowPay(false);
      setSale(null);
      await handleNewSale();
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "Erro ao finalizar venda", false);
    } finally {
      setPaying(false);
    }
  }

  async function handleCancelSale() {
    if (!sale) return;
    await cancelSale(sale.id);
    setSale(null);
    await handleNewSale();
  }

  async function handleSessionClosed() {
    setShowCloseModal(false);
    setSale(null);
    await refreshSession();
  }

  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <OpenSessionPage onOpened={() => refreshSession()} />;
  }

  const currentSale = sale as Sale | null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Modals */}
      {showCloseModal && (
        <CloseSessionModal
          sessionId={session.id}
          onClose={() => setShowCloseModal(false)}
          onConfirmed={handleSessionClosed}
        />
      )}
      {movementType && (
        <MovementModal
          sessionId={session.id}
          defaultType={movementType}
          onClose={() => setMovementType(null)}
        />
      )}
      {showDavSearch && (
        <DavSearchModal
          onSelect={(code) => setDavCode(code)}
          onClose={() => setShowDavSearch(false)}
        />
      )}

      {/* Top Bar */}
      <div className="bg-white shadow-sm px-4 py-2 flex items-center gap-2 flex-wrap min-h-[52px]">
        <span className="font-bold text-base" style={{ color: "#7c5cf8" }}>PDV</span>
        <span className="text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">{session.registerName}</span>
        <span className="hidden sm:block text-xs text-gray-400 ml-1">
          Â· {session.openedByUserName}
        </span>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
          <button
            onClick={() => setMovementType("Sangria")}
            className="text-xs text-red-500 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-50 transition whitespace-nowrap"
          >
            Sangria
          </button>
          <button
            onClick={() => setMovementType("Suprimento")}
            className="text-xs text-green-600 border border-green-200 px-2.5 py-1 rounded-full hover:bg-green-50 transition whitespace-nowrap"
          >
            Suprimento
          </button>
          <button
            onClick={() => setShowCloseModal(true)}
            className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-50 transition whitespace-nowrap"
          >
            Fechar Caixa
          </button>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-white text-sm shadow-lg z-40 transition ${
            feedback.ok ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* â”€â”€ Mobile: Payment panel overlay when showPay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showPay && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50 flex items-end" onClick={() => setShowPay(false)}>
          <div
            className="w-full bg-white rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{brl(currentSale?.subtotalCents ?? 0)}</span>
              </div>
              {(currentSale?.discountCents ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Desconto</span><span>-{brl(currentSale!.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-800 border-t pt-2 mt-1">
                <span>Total</span><span>{brl(currentSale?.totalCents ?? 0)}</span>
              </div>
            </div>
            <PayPanel
              totalCents={currentSale?.totalCents ?? 0}
              onPay={handlePay}
              onCancel={handleCancelSale}
              paying={paying}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-3 p-3 sm:p-4 min-h-0">
        {/* â”€â”€ Left: Barcode + Item list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <form onSubmit={handleScan} className="flex gap-2">
            <input
              ref={barcodeRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="CÃ³digo de barras..."
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
            />
            <button
              type="submit"
              disabled={scanning || !barcode.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition active:scale-95 disabled:opacity-50"
              style={{ background: "#7c5cf8" }}
            >
              {scanning ? "..." : "Ler"}
            </button>
          </form>

          {/* â”€â”€ DAV Import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <form onSubmit={handleImportDav} className="flex gap-2 items-center">
            <div className="flex-1 flex items-center border border-emerald-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-emerald-400 overflow-hidden">
              <span className="pl-3 pr-1 text-xs font-bold text-emerald-600 select-none whitespace-nowrap">DAV-</span>
              <input
                value={davCode}
                onChange={(e) => setDavCode(e.target.value.replace(/^DAV-/i, ""))}
                placeholder="cÃ³digo ou escaneieâ€¦"
                className="flex-1 py-2 pr-3 text-sm bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={importingDav || !davCode.trim()}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
              style={{ background: "#10b981" }}
            >
              {importingDav ? "â€¦" : "Importar"}
            </button>
            <button
              type="button"
              title="Buscar orÃ§amento"
              onClick={() => setShowDavSearch(true)}
              className="p-2 rounded-xl border border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition"
            >
              <Search size={16} />
            </button>
          </form>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-100" style={{ minHeight: 200, flex: "1 1 0" }}>
            <QuickProducts
              saleId={currentSale?.id ?? ""}
              onAdded={async (name) => {
                if (currentSale) await refreshSale(currentSale.id);
                flash(`${name} adicionado`, true);
                barcodeRef.current?.focus();
              }}
            />
          </div>

          <div className="lg:hidden bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100" style={{ minHeight: 180 }}>
            <CartTable sale={currentSale} onRemove={handleRemoveItem} />
          </div>


          {/* Mobile: sticky cobrar bar */}
          <div className="lg:hidden">
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-2xl font-black text-gray-800">{brl(currentSale?.totalCents ?? 0)}</div>
                {currentSale?.publicId && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{currentSale.publicId}</div>
                )}
              </div>
              <button
                disabled={!currentSale || currentSale.items.length === 0}
                onClick={() => setShowPay(true)}
                className="shrink-0 px-6 py-3 rounded-xl text-white font-semibold transition active:scale-95 disabled:opacity-40 text-base"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                Cobrar
              </button>
            </div>
          </div>
        </div>

        {/* â”€â”€ Right: Totals + Payment (desktop only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="hidden lg:flex w-[420px] xl:w-[460px] flex-col gap-3 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3 border border-gray-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resumo da venda</p>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{brl(currentSale?.subtotalCents ?? 0)}</span>
            </div>
            {(currentSale?.discountCents ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Desconto</span>
                <span>-{brl(currentSale!.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-black text-gray-800 border-t pt-3">
              <span>Total</span>
              <span>{brl(currentSale?.totalCents ?? 0)}</span>
            </div>

            {!showPay ? (
              <button
                disabled={!currentSale || currentSale.items.length === 0}
                onClick={() => setShowPay(true)}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition active:scale-95 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                Cobrar
              </button>
            ) : (
              <PayPanel
                totalCents={currentSale?.totalCents ?? 0}
                onPay={handlePay}
                onCancel={handleCancelSale}
                paying={paying}
              />
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 flex-1 min-h-[340px]">
            <CartTable sale={currentSale} onRemove={handleRemoveItem} />
          </div>

          {currentSale?.publicId && (
            <p className="text-center text-xs text-gray-400">{currentSale.publicId}</p>
          )}
        </div>
      </div>
    </div>
  );
}
