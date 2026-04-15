import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, X, Menu, LayoutGrid, ShoppingBag, Coffee, Headphones, ChevronRight, Printer, Smartphone, Ban, CheckCircle2, ArrowRight, User, Snowflake, Sandwich, CupSoda, type LucideIcon } from "lucide-react";
import { usePdv } from "@/features/pdv/PdvContext";

// â”€â”€ Design tokens (Go Coffee palette) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GC = {
  bg:      "#FAF7F2",
  cream:   "#F5EDE0",
  brown:   "#6B4F3A",
  dark:    "#1C1209",
  caramel: "#C8953A",
};
import {
  createSale, scanBarcode, removeItem, paySale, cancelSale, patchSaleCustomer,
  closeSession, getSessionReport, addMovement, importDav, addItem,
  evaluateSalePromotions, searchCustomer,
  type Sale, type CupomData, type SessionReport, type PdvCustomer,
} from "@/features/pdv/api";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import type { Product, ProductAddonGroup } from "@/features/catalog/api";
import { ProductAddonStepper } from "@/features/catalog/ProductAddonStepper";
import { parseSyntheticProductId } from "@/features/catalog/syntheticProductId";
import OpenSessionPage from "./OpenSessionPage";

//

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const payMethodLabel = (m: string): string =>
  ({ PIX: "PIX", DINHEIRO: "Dinheiro", CARTAO_CREDITO: "Cartao Credito",
     CARTAO_DEBITO: "Cartao Debito", CHEQUE: "Cheque" }[m] ?? m);

//

function printCupom(data: CupomData) {
  const itemRows = data.items.map((i) => {
    const qtyLabel = i.isSoldByWeight ? `${i.weightKg?.toFixed(3)} kg` : `${i.qty}x`;
    const addonsTotalCents = (i.addons ?? []).reduce((sum, a) => sum + a.priceCentsSnapshot, 0);
    const baseTotalCents = i.totalCents - addonsTotalCents;
    const addonRows = (i.addons ?? []).map((a) =>
      `<tr>
        <td colspan="2" style="font-size:10px;color:#555;padding-left:10px">+ ${a.nameSnapshot}</td>
        <td style="font-size:10px;text-align:right;color:#555">+${brl(a.priceCentsSnapshot)}</td>
      </tr>`
    ).join("");
    const addonsSummaryRow = addonsTotalCents > 0
      ? `<tr>
          <td colspan="2" style="font-size:10px;color:#555;padding-left:10px">Subtotal adicionais</td>
          <td style="font-size:10px;text-align:right;color:#555">+${brl(addonsTotalCents)}</td>
        </tr>`
      : "";

    return `
      <tr><td colspan="3" style="font-size:11px;font-weight:600;padding-top:4px">${i.productNameSnapshot}</td></tr>
      <tr style="color:#555">
        <td style="font-size:11px">${qtyLabel}</td>
        <td style="font-size:11px;color:#555">Valor do produto</td>
        <td style="font-size:11px;text-align:right">${brl(baseTotalCents)}</td>
      </tr>
      ${addonRows}
      ${addonsSummaryRow}
      <tr>
        <td colspan="2" style="font-size:11px;text-align:right;font-weight:700;color:#111;padding-top:2px">Total item (produto + adicionais)</td>
        <td style="font-size:11px;text-align:right;font-weight:700;color:#111;padding-top:2px">${brl(i.totalCents)}</td>
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
    ? `<p style="font-size:9px;color:#c00;text-align:center;margin-top:4px">ATENCAO: VENDA EM CONTINGENCIA - NFC-e nao emitida</p>` : "";

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
<p class="sub">CUPOM NAO FISCAL</p>
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
<p class="thanks">Obrigado pela preferencia!</p>
</body></html>`;

  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

//

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(28,18,9,0.65)" }}>
      <div className="rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        style={{ background: GC.bg, boxShadow: "0 24px 80px rgba(28,18,9,0.35)" }}>
        <h2 className="font-black text-base" style={{ color: GC.dark }}>Movimento de Caixa</h2>

        <div className="flex gap-2">
          {(["Sangria", "Suprimento"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition"
              style={type === t
                ? { background: t === "Sangria" ? "#dc2626" : "#059669", color: "#fff" }
                : { border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold" style={{ color: GC.brown, opacity: 0.7 }}>Valor (R$)</label>
            <input
              type="number" min={0} step={0.01} autoFocus
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold" style={{ color: GC.brown, opacity: 0.7 }}>Descricao (opcional)</label>
            <input
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={type === "Sangria" ? "Ex: Recolhimento parcial" : "Ex: Reforco de troco"}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl font-medium transition hover:opacity-80"
            style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
            Cancelar
          </button>
          <button
            disabled={!ok || loading}
            onClick={handleSubmit}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition disabled:opacity-40"
            style={{ background: type === "Sangria" ? "#dc2626" : "#059669" }}
          >
            {loading ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

//

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ backgroundColor: "rgba(28,18,9,0.65)" }}>
      <div className="rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5"
        style={{ background: GC.bg, boxShadow: "0 24px 80px rgba(28,18,9,0.35)" }}>
        <h2 className="text-lg font-black" style={{ color: GC.dark }}>Fechamento de Caixa</h2>

        {loadingRpt ? (
          <p className="text-center py-8 text-sm" style={{ color: GC.brown }}>Carregando...</p>
        ) : report && (
          <>
            {/* Resumo vendas */}
            <div className="rounded-2xl p-4 space-y-2" style={{ background: GC.cream }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: GC.brown }}>Resumo de Vendas</p>
              <div className="flex justify-between text-sm" style={{ color: GC.dark }}>
                <span style={{ color: GC.brown }}>{report.totalSalesCount} venda(s)</span>
                <span className="font-bold">{brl(report.totalSalesCents)}</span>
              </div>
              {report.byPaymentMethod.map((b) => (
                <div key={b.paymentMethod} className="flex justify-between text-sm" style={{ color: GC.brown, opacity: 0.75 }}>
                  <span>{payMethodLabel(b.paymentMethod)}</span>
                  <span>{brl(b.totalCents)}</span>
                </div>
              ))}
              {report.cancelledSalesCount > 0 && (
                <p className="text-xs text-red-500">{report.cancelledSalesCount} venda(s) cancelada(s)</p>
              )}
            </div>

            {/* Movimentos */}
            {(report.totalSangriaCents > 0 || report.totalSuprimentoCents > 0) && (
              <div className="rounded-2xl p-4 space-y-2" style={{ background: GC.cream }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: GC.brown }}>Movimentos</p>
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

            {/* Conferencia */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: GC.brown }}>Conferencia de Caixa</p>
              <div className="flex justify-between text-sm rounded-2xl px-4 py-3"
                style={{ background: `${GC.caramel}18`, color: GC.caramel }}>
                <span className="font-medium">Saldo esperado</span>
                <span className="font-bold">{brl(expectedCash)}</span>
              </div>
              <div>
                <label className="text-[11px] font-bold" style={{ color: GC.brown, opacity: 0.7 }}>Contagem fisica (R$)</label>
                <input
                  type="number" min={0} step={0.01}
                  className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
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
                  <span>Divergencia</span>
                  <span className="font-semibold">{divergence > 0 ? "+" : ""}{brl(divergence)}</span>
                </div>
              )}
            </div>

            {/* Observacoes */}
            <div>
              <label className="text-[11px] font-bold" style={{ color: GC.brown, opacity: 0.7 }}>Observacoes (opcional)</label>
              <textarea
                className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
                style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-2.5 text-sm rounded-xl font-medium transition hover:opacity-80"
            style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
            Cancelar
          </button>
          <button
            disabled={loadingRpt || submitting}
            onClick={handleConfirm}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition disabled:opacity-40"
            style={{ background: "#dc2626" }}
          >
            {submitting ? "Fechando..." : "Fechar Caixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

//

type PayMethod = { method: string; label: string; color: string };

const PAY_METHODS: PayMethod[] = [
  { method: "PIX",            label: "PIX",           color: "#0891b2" },
  { method: "DINHEIRO",       label: "Dinheiro",       color: "#059669" },
  { method: "CARTAO_CREDITO", label: "Credito",        color: GC.caramel },
  { method: "CARTAO_DEBITO",  label: "Debito",         color: GC.brown },
];

// â”€â”€ SaleCompleteModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type SaleCompleteAction = "print" | "skip" | "whatsapp";

function sanitizeUiText(raw: string): string {
  return raw.replace(/Â/g, "").replace(/\uFFFD/g, "");
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : "";
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function SaleCompleteModal({
  saleId, publicId, totalCents, changeCents, customerPhone: initialPhone, onClose,
}: {
  saleId: string; publicId: string; totalCents: number;
  changeCents: number; customerPhone: string | null;
  onClose: () => void;
}) {
  const hasPhone = Boolean(initialPhone && initialPhone.trim());
  const [chosen, setChosen]     = useState<SaleCompleteAction | null>(null);
  const [phone, setPhone]       = useState(hasPhone ? maskPhone(initialPhone!) : "");
  const [phoneErr, setPhoneErr] = useState("");
  const [waStatus, setWaStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [printing, setPrinting] = useState(false);

  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function handlePrint() {
    setPrinting(true);
    try {
      const cupomData = await adminFetch<Parameters<typeof printCupom>[0]>(`/pdv/sale/${saleId}/cupom`);
      printCupom(cupomData);
    } finally {
      setPrinting(false);
      onClose();
    }
  }

  async function handleWhatsApp(phoneOverride?: string) {
    const raw    = phoneOverride ?? phone;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10) { setPhoneErr("Informe um numero valido com DDD."); return; }
    setPhoneErr("");
    setWaStatus("saving");
    try {
      await adminFetch(`/pdv/sale/${saleId}/customer-phone`, {
        method: "PATCH",
        body: JSON.stringify({ customerPhone: raw.trim() }),
      });
      setWaStatus("ok");
      setTimeout(onClose, 1800);
    } catch {
      setWaStatus("err");
    }
  }

  const CARDS: { key: SaleCompleteAction; icon: ReactNode; title: string; desc: string; accent: string; highlighted?: boolean }[] = [
    {
      key: "print",
      icon: <Printer size={22} />,
      title: "Imprimir comprovante",
      desc: "Imprime o cupom fiscal na impressora configurada",
      accent: GC.caramel,
      highlighted: true,
    },
    {
      key: "whatsapp",
      icon: <Smartphone size={22} />,
      title: "Receber no WhatsApp",
      desc: hasPhone ? `Enviar para ${maskPhone(initialPhone!)}` : "Informe o telefone para enviar o PDF",
      accent: "#16a34a",
    },
    {
      key: "skip",
      icon: <Ban size={22} />,
      title: "Não imprimir",
      desc: "Fechar sem imprimir",
      accent: "#6b7280",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(28,18,9,0.72)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: GC.bg, border: `1.5px solid ${GC.caramel}33` }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ background: `linear-gradient(160deg, ${GC.dark} 0%, #2A1A0E 100%)` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A07230)` }}>
            <CheckCircle2 size={28} className="text-[#1C1209]" />
          </div>
          <p className="text-lg font-black text-white tracking-tight">Venda concluida!</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(245,237,224,0.6)" }}>#{publicId}</p>
          <p className="text-3xl font-black mt-2" style={{ color: GC.caramel }}>{brl(totalCents)}</p>
          {changeCents > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "#16a34a22", color: "#4ade80" }}>
              <span>Troco:</span>
              <span>{brl(changeCents)}</span>
            </div>
          )}
        </div>

        {/* Action cards or WhatsApp step */}
        <div className="p-5 space-y-3">
          {chosen !== "whatsapp" ? (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-center mb-1"
                style={{ color: GC.brown }}>O que deseja fazer?</p>

              {CARDS.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  disabled={printing || waStatus === "saving"}
                  onClick={() => {
                    if (card.key === "print")     { handlePrint(); return; }
                    if (card.key === "skip")      { onClose(); return; }
                    // WhatsApp: se ja tem telefone, dispara direto; senao abre step
                    if (hasPhone) { handleWhatsApp(initialPhone!); return; }
                    setChosen("whatsapp");
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition active:scale-[0.98] hover:brightness-95"
                  style={card.highlighted
                    ? { background: `linear-gradient(135deg, ${card.accent}, #A07230)`, boxShadow: `0 4px 18px ${card.accent}44` }
                    : { background: GC.cream, border: `1.5px solid rgba(107,79,58,0.14)` }}
                >
                  <span className="text-2xl flex-shrink-0">{card.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-bold ${card.highlighted ? "text-white" : ""}`}
                      style={card.highlighted ? undefined : { color: GC.dark }}>
                      {card.title}
                    </span>
                    <span className={`block text-xs mt-0.5 truncate ${card.highlighted ? "text-white/70" : ""}`}
                      style={card.highlighted ? undefined : { color: GC.brown }}>
                      {card.desc}
                    </span>
                  </span>
                  {card.highlighted && (
                    <span className="text-xs font-black text-white/80 shrink-0"><ArrowRight size={14} /></span>
                  )}
                </button>
              ))}

              {/* Inline sending feedback when dispatching directly */}
              {waStatus === "saving" && (
                <p className="text-center text-xs" style={{ color: GC.brown }}>Registrando numero...</p>
              )}
              {waStatus === "ok" && (
                <div className="rounded-2xl p-3 text-center" style={{ background: "#dcfce7" }}>
                  <p className="text-sm font-bold text-green-700">PDF sera enviado no WhatsApp!</p>
                </div>
              )}
            </>
          ) : (
            /* WhatsApp step - so aparece quando nao ha telefone cadastrado */
            <div className="space-y-3">
              <button type="button" onClick={() => setChosen(null)}
                className="flex items-center gap-1 text-xs font-medium transition hover:opacity-70"
                style={{ color: GC.brown }}>
                Voltar
              </button>

              <p className="text-sm font-bold" style={{ color: GC.dark }}>
                Enviar NFC-e por WhatsApp
              </p>
              <p className="text-xs" style={{ color: GC.brown }}>
                O comprovante em PDF sera enviado apos autorizacao da nota fiscal.
              </p>

              {waStatus === "ok" ? (
                <div className="rounded-2xl p-4 text-center" style={{ background: "#dcfce7" }}>
                  <p className="text-sm font-bold text-green-700">Numero registrado!</p>
                  <p className="text-xs text-green-600 mt-0.5">O PDF chegara no WhatsApp em instantes.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: GC.brown }}>
                      Telefone do cliente (com DDD)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(maskPhone(e.target.value)); setPhoneErr(""); }}
                      placeholder="(11) 99999-0000"
                      autoFocus
                      className="w-full h-11 rounded-xl px-4 text-sm focus:outline-none"
                      style={{ border: `1.5px solid rgba(107,79,58,0.2)`, background: "#fff", color: GC.dark }}
                    />
                    {phoneErr && <p className="text-xs text-red-500">{phoneErr}</p>}
                    {waStatus === "err" && <p className="text-xs text-red-500">Erro ao salvar. Tente novamente.</p>}
                  </div>

                    <button
                      type="button"
                      disabled={waStatus === "saving"}
                      onClick={() => handleWhatsApp()}
                    className="w-full h-12 rounded-2xl text-white text-sm font-bold transition active:scale-[0.98] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 14px #16a34a44" }}
                    >
                      {waStatus === "saving" ? "Salvando..." : "Confirmar envio"}
                    </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// â”€â”€ PayPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PayPanelProps {
  saleId: string;
  subtotalCents: number;
  baseDiscountCents: number;
  totalCents: number;
  appliedCoupon: { code: string; discountCents: number; promotionName: string; promotionId?: string } | null;
  onApplyCoupon: (couponCode: string) => Promise<void>;
  onRemoveCoupon: () => void;
  onPay: (method: string, amountCents: number, customerDocument?: string, customerCpfForLoyalty?: string) => void;
  onCancel: () => void;
  paying: boolean;
  defaultMethod?: string | null;
  defaultAmountCents?: number | null;
}

function PayPanel({
  saleId,
  subtotalCents,
  baseDiscountCents,
  totalCents,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  onPay,
  onCancel,
  paying,
  defaultMethod,
  defaultAmountCents,
}: PayPanelProps) {
  const [cash, setCash] = useState("");
  const [pendingPayment, setPendingPayment] = useState<{ method: string; amountCents: number } | null>(null);
  const [docType, setDocType] = useState<"none" | "cpf" | "cnpj">("none");
  const [docValue, setDocValue] = useState("");
  const [docError, setDocError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const openDocPrompt = (method: string, amountCents: number) => {
    setPendingPayment({ method, amountCents });
    setDocType("none");
    setDocValue("");
    setDocError(null);
  };

  const closeDocPrompt = () => {
    setPendingPayment(null);
    setDocType("none");
    setDocValue("");
    setDocError(null);
  };

  const confirmPay = () => {
    if (!pendingPayment) return;
    const digits = docValue.replace(/\D/g, "");
    if (docType === "cpf" && digits.length !== 11) {
      setDocError("CPF deve ter 11 digitos.");
      return;
    }
    if (docType === "cnpj" && digits.length !== 14) {
      setDocError("CNPJ deve ter 14 digitos.");
      return;
    }
    const customerDocument = docType === "none" ? undefined : digits;
    const customerCpfForLoyalty = docType === "cpf" ? digits : undefined;
    onPay(pendingPayment.method, pendingPayment.amountCents, customerDocument, customerCpfForLoyalty);
    closeDocPrompt();
  };

  const normalizeCoupon = (raw: string) =>
    raw
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 24);

  const handleApplyCoupon = async () => {
    if (!saleId) return;
    const code = normalizeCoupon(couponInput.trim());
    if (code.length < 4) {
      setCouponError("Use um código com ao menos 4 caracteres.");
      return;
    }

    try {
      setCouponLoading(true);
      setCouponError(null);
      await onApplyCoupon(code);
      setCouponInput(code);
    } catch (e: unknown) {
      setCouponError(e instanceof Error ? e.message : "Não foi possível aplicar o cupom.");
    } finally {
      setCouponLoading(false);
    }
  };

  const totalDiscountCents = Math.max(baseDiscountCents, appliedCoupon?.discountCents ?? 0);
  const suggestedMethod = defaultMethod ?? null;
  const suggestedAmountCents = defaultAmountCents ?? totalCents;
  const suggestedPayMethod = suggestedMethod
    ? PAY_METHODS.find((p) => p.method === suggestedMethod) ?? null
    : null;

  useEffect(() => {
    if (suggestedMethod === "DINHEIRO" && suggestedAmountCents > 0) {
      setCash((suggestedAmountCents / 100).toFixed(2));
    }
  }, [suggestedMethod, suggestedAmountCents]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-3 space-y-2.5"
        style={{ background: "#fff", border: `1.5px solid rgba(107,79,58,0.15)` }}>
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: GC.brown }}>Cupom de desconto</p>

        {!appliedCoupon ? (
          <>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(normalizeCoupon(e.target.value));
                  setCouponError(null);
                }}
                placeholder="Ex: BEMVINDO10"
                className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none uppercase"
                style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
              />
              <button
                type="button"
                disabled={couponLoading || paying || !saleId}
                onClick={handleApplyCoupon}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${GC.caramel}, #b9822d)` }}
              >
                {couponLoading ? "..." : "Aplicar"}
              </button>
            </div>
            {couponError && <p className="text-xs text-red-500">{couponError}</p>}
          </>
        ) : (
          <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
            style={{ background: `${GC.caramel}18`, color: GC.dark }}>
            <div className="min-w-0">
              <p className="text-xs font-black truncate">Cupom {appliedCoupon.code}</p>
              <p className="text-[11px] truncate opacity-75">
                {sanitizeUiText(appliedCoupon.promotionName)} · -{brl(appliedCoupon.discountCents)}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemoveCoupon}
              disabled={paying}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-85 disabled:opacity-40"
              style={{ background: "#fff", color: GC.brown, border: `1px solid rgba(107,79,58,0.2)` }}
            >
              Remover
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl p-3 space-y-1.5"
        style={{ background: "#fff", border: `1.5px solid rgba(107,79,58,0.12)` }}>
        <div className="flex justify-between text-xs" style={{ color: GC.brown }}>
          <span>Subtotal</span>
          <span>{brl(subtotalCents)}</span>
        </div>
        {totalDiscountCents > 0 && (
          <div className="flex justify-between text-xs text-red-500">
            <span>Desconto aplicado</span>
            <span>-{brl(totalDiscountCents)}</span>
          </div>
        )}
      </div>

      <p className="text-center text-2xl font-black" style={{ color: GC.dark }}>{brl(totalCents)}</p>

      {suggestedPayMethod && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: `${GC.caramel}15`, color: GC.caramel }}>
          <span className="opacity-70">Sugestao do atendimento:</span>
          <span className="font-black">{suggestedPayMethod.label}</span>
        </div>
      )}

      {suggestedPayMethod && suggestedAmountCents > 0 && (
        <button
          disabled={paying}
          onClick={() => openDocPrompt(suggestedPayMethod.method, suggestedAmountCents)}
          className="w-full py-2.5 rounded-xl text-white text-sm font-black transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #047857, #065f46)" }}>
          Confirmar pagamento sugerido {suggestedPayMethod.method === "DINHEIRO" ? `(recebido ${brl(suggestedAmountCents)})` : ""}
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {PAY_METHODS.map((pm) => {
          const isSuggested = suggestedPayMethod?.method === pm.method;
          return (
            <button
              key={pm.method}
              disabled={paying}
              onClick={() => openDocPrompt(pm.method, totalCents)}
              className="py-3 rounded-2xl text-white font-bold text-sm transition active:scale-95 hover:opacity-90 relative"
              style={{ background: pm.color, boxShadow: isSuggested ? `0 0 0 3px ${pm.color}55, 0 4px 14px ${pm.color}44` : undefined }}
            >
              {isSuggested && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-black bg-white rounded-full px-2 py-0.5 leading-none"
                  style={{ color: pm.color }}>
                  sugerido
                </span>
              )}
              {pm.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="number"
          placeholder="Dinheiro recebido (R$)"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
          value={cash}
          onChange={(e) => setCash(e.target.value)}
        />
        <button
          disabled={paying || !cash}
          onClick={() => openDocPrompt("DINHEIRO", Math.round(parseFloat(cash || "0") * 100))}
          className="px-4 py-2.5 rounded-xl text-white text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "#059669" }}
        >
          OK
        </button>
      </div>

      {pendingPayment && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: GC.cream, border: `1.5px solid rgba(200,149,58,0.2)` }}>
          <p className="text-sm font-bold" style={{ color: GC.dark }}>Incluir CPF/CNPJ na nota fiscal?</p>
          <div className="grid grid-cols-3 gap-2">
            {(["none", "cpf", "cnpj"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setDocType(t); setDocError(null); }}
                className="py-2 rounded-xl text-xs font-bold transition"
                style={docType === t
                  ? { background: GC.caramel, color: "#fff" }
                  : { border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: "#fff" }}
              >
                {t === "none" ? "Não informar" : t.toUpperCase()}
              </button>
            ))}
          </div>
          {docType !== "none" && (
            <input
              value={docValue}
              onChange={(e) => setDocValue(e.target.value)}
              placeholder={docType === "cpf" ? "Digite o CPF" : "Digite o CNPJ"}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
            />
          )}
          {docType === "cpf" && (
            <p className="text-[11px]" style={{ color: GC.brown, opacity: 0.75 }}>
              Este CPF tambem confirma o acumulo de pontos de fidelidade para cliente identificado.
            </p>
          )}
          {docError && <p className="text-xs text-red-500">{docError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={closeDocPrompt}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition hover:opacity-80"
              style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: "#fff" }}>
              Voltar
            </button>
            <button type="button" onClick={confirmPay}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-bold transition hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
              Confirmar pagamento
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        disabled={paying}
        className="w-full py-2.5 rounded-xl text-sm font-medium transition hover:opacity-80"
        style={{ border: `1.5px solid rgba(220,38,38,0.35)`, color: "#dc2626", background: "#fff5f5" }}
      >
        Cancelar venda
      </button>
    </div>
  );
}

//

interface DavSummary { id: string; publicId: string; customerName: string; totalCents: number; itemCount: number; status: string; }

function DavSearchModal({ onSelect, onClose }: { onSelect: (code: string) => void; onClose: () => void }) {
  const [q, setQ]               = useState("");
  const [results, setResults]   = useState<DavSummary[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    setLoading(true);
    adminFetch<{ items: DavSummary[] }>(`/admin/dav?pageSize=200&from=${from.toISOString()}`)
      .then((r) => setResults(r.items.filter((d) => d.status !== "Converted" && d.status !== "Cancelled")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filtered = q.trim()
    ? results.filter((d) => d.publicId.toLowerCase().includes(q.toLowerCase()) || d.customerName?.toLowerCase().includes(q.toLowerCase()))
    : results;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      style={{ backgroundColor: "rgba(28,18,9,0.65)" }}>
      <div className="rounded-3xl shadow-2xl w-full max-w-sm flex flex-col max-h-[70vh]"
        style={{ background: GC.bg, boxShadow: "0 24px 80px rgba(28,18,9,0.35)" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: `1px solid rgba(107,79,58,0.1)` }}>
          <h3 className="font-black text-sm" style={{ color: GC.dark }}>Buscar Orcamento (DAV)</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: GC.cream }}>
            <X size={13} style={{ color: GC.brown }} />
          </button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff" }}>
            <Search size={14} style={{ color: GC.brown, opacity: 0.5 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Codigo ou nome do cliente..."
              className="flex-1 text-sm bg-transparent outline-none placeholder-opacity-50"
              style={{ color: GC.dark }} />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {loading && <p className="text-center py-6 text-sm" style={{ color: GC.brown }}>Carregando...</p>}
          {!loading && filtered.length === 0 && <p className="text-center py-6 text-sm" style={{ color: GC.brown, opacity: 0.6 }}>Nenhum orcamento encontrado.</p>}
          {filtered.map((d) => (
            <button key={d.id} type="button"
              onClick={() => { onSelect(d.publicId); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition hover:bg-amber-50/60"
            >
              <div>
                <p className="text-sm font-bold" style={{ color: GC.caramel }}>{d.publicId}</p>
                <p className="text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.65 }}>
                  {d.customerName || "-"} · {d.itemCount} item{d.itemCount !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-sm font-black" style={{ color: GC.dark }}>{fmt(d.totalCents)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

//

interface QuickProduct {
  id: string;
  name: string;
  priceCents: number;
  promotionPriceCents?: number | null;
  imageUrl?: string | null;
  hasAddons: boolean;
  isBestSeller?: boolean;
  barcode?: string | null;
  internalCode?: string | null;
  categoryName?: string | null;
}

interface AddonOption {
  id: string;
  name: string;
  priceCents: number;
  isActive?: boolean;
  addonGroupId?: string | null;
}

interface AddonGroupRaw {
  id: string;
  name: string;
  isRequired: boolean;
  selectionType: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
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
  const [addonGroups, setAddonGroups] = useState<ProductAddonGroup[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminFetch<AddonOption[]>(`/admin/products/${product.id}/addons`),
      adminFetch<AddonGroupRaw[]>(`/admin/products/${product.id}/addon-groups`),
    ])
      .then(([allAddons, groupsRaw]) => {
        const activeAddons = allAddons.filter((a) => a.isActive !== false);
        setAddons(activeAddons);

        if (groupsRaw.length > 0) {
          // Grupos configurados: monta estrutura real
          const groups: ProductAddonGroup[] = groupsRaw.map((g) => ({
            id: g.id,
            name: g.name,
            isRequired: g.isRequired,
            selectionType: g.selectionType as "single" | "multiple",
            minSelections: g.minSelections,
            maxSelections: g.maxSelections,
            sortOrder: g.sortOrder,
            addons: activeAddons
              .filter((a) => a.addonGroupId === g.id)
              .map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents, addonGroupId: g.id })),
          }));
          setAddonGroups(groups);
        } else if (activeAddons.length > 0) {
          // Sem grupos configurados: classifica adicionais pelas mesmas regras do backend
          const classify = (name: string, price: number): { group: string; sort: number } => {
            const n = name.toLowerCase();
            if (n.includes("leite") || n.includes("lactose") || n.includes("aveia") ||
                n.includes("integral") || n.includes("soja") || n.includes("coco"))
              return { group: "Tipo de Leite", sort: 1 };
            if (n.includes("cobertura") || n.includes("chantilly") || n.includes("ganache"))
              return { group: "Cobertura", sort: 2 };
            if (price === 0)
              return { group: "Sabor", sort: 0 };
            return { group: "Extras", sort: 3 };
          };

          const buckets = new Map<string, { sort: number; addons: AddonOption[] }>();
          for (const a of activeAddons) {
            const { group, sort } = classify(a.name, a.priceCents);
            if (!buckets.has(group)) buckets.set(group, { sort, addons: [] });
            buckets.get(group)!.addons.push(a);
          }

          const groups: ProductAddonGroup[] = [];
          for (const [groupName, { sort, addons }] of [...buckets.entries()].sort((a, b) => a[1].sort - b[1].sort)) {
            const gid = `${product.id}__${groupName.replace(/\s+/g, "_").toLowerCase()}`;
            let ordered = addons;
            if (groupName === "Tipo de Leite") {
              ordered = [...addons].sort((a) =>
                (a.name.toLowerCase().includes("integral") || a.name.toLowerCase().includes("(padrão)")) ? -1 : 1
              );
            }
            groups.push({
              id: gid,
              name: groupName,
              isRequired: false,
              selectionType: groupName === "Extras" ? "multiple" : "single",
              minSelections: 0,
              maxSelections: groupName === "Extras" ? 0 : 1,
              sortOrder: sort,
              addons: ordered.map((a, i) => ({
                id: a.id,
                name: a.name,
                priceCents: a.priceCents,
                addonGroupId: gid,
                isDefault: groupName === "Tipo de Leite" && i === 0,
              })),
            });
          }
          setAddonGroups(groups.length > 0 ? groups : [{
            id: `${product.id}__default`,
            name: "Adicionais",
            isRequired: false,
            selectionType: "multiple",
            minSelections: 0,
            maxSelections: 0,
            sortOrder: 0,
            addons: activeAddons.map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents, addonGroupId: `${product.id}__default` })),
          }]);
        }
      })
      .catch(() => { setAddons([]); setAddonGroups([]); })
      .finally(() => setLoading(false));
  }, [product.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasGroups = addonGroups.length > 0;

  const extraCents = addons
    .filter((a) => selected.has(a.id))
    .reduce((s, a) => s + a.priceCents, 0);

  async function handleFlatConfirm(addonIds: string[]) {
    setAdding(true);
    try {
      const override = product.promotionPriceCents ?? undefined;
      await addItem(saleId, { productId: product.id, qty: 1, addonIds: addonIds.length ? addonIds : undefined, unitPriceCentsOverride: override });
      onConfirm(product.name);
    } finally {
      setAdding(false);
    }
  }

  async function handleStepperConfirm(synthetic: Product, confirmedQty: number) {
    setAdding(true);
    try {
      const { addonIds } = parseSyntheticProductId(synthetic.id);
      const override = product.promotionPriceCents ?? undefined;
      await addItem(saleId, {
        productId: product.id,
        qty: confirmedQty,
        addonIds: addonIds.length ? addonIds : undefined,
        unitPriceCentsOverride: override,
      });
      onConfirm(product.name);
    } finally {
      setAdding(false);
    }
  }

  // Build a Product-compatible object for the stepper
  const stepperProduct: Product = {
    id: product.id,
    name: product.name,
    slug: "",
    priceCents: product.promotionPriceCents ?? product.priceCents,
    imageUrl: product.imageUrl ?? null,
    description: null,
    isFeatured: false,
    isBestSeller: product.isBestSeller ?? false,
    discountPercent: null,
    category: { id: "", name: product.categoryName ?? "", slug: "" },
    variants: [],
    addons: addons.map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents, addonGroupId: a.addonGroupId ?? null })),
    addonGroups,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(28,18,9,0.65)" }}>
      <div
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative flex flex-col"
        style={{
          background: GC.bg,
          boxShadow: "0 24px 80px rgba(28,18,9,0.35)",
          maxHeight: "85vh",
        }}
      >
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-xl flex items-center justify-center z-10"
          style={{ background: GC.cream }}>
          <X size={13} style={{ color: GC.brown }} />
        </button>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h2 className="font-black text-base pr-8" style={{ color: GC.dark }}>{product.name}</h2>
          {hasGroups ? (
            <p className="text-xs mt-0.5 font-medium" style={{ color: GC.brown, opacity: 0.65 }}>
              a partir de {brl(product.promotionPriceCents ?? product.priceCents)}
            </p>
          ) : (
            <p className="text-xs mt-0.5 font-medium" style={{ color: GC.brown, opacity: 0.65 }}>Escolha os adicionais</p>
          )}
        </div>

        {loading ? (
          <div className="px-5 pb-5">
            <p className="text-sm py-4 text-center" style={{ color: GC.brown }}>Carregando...</p>
          </div>
        ) : hasGroups ? (
          /* ── Modo stepper ─── */
          <div
            className="flex-1 min-h-0 overflow-hidden"
            style={{ "--brand": GC.caramel } as React.CSSProperties}
          >
            <ProductAddonStepper
              product={stepperProduct}
              onConfirm={handleStepperConfirm}
              onCancel={onClose}
            />
          </div>
        ) : (
          /* ── Modo lista plana ─── */
          <div className="px-5 pb-5 space-y-4">
            {addons.length === 0 ? (
              <p className="text-sm py-2" style={{ color: GC.brown, opacity: 0.6 }}>Nenhum adicional disponivel.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {addons.map((a) => (
                  <button key={a.id} type="button" onClick={() => toggle(a.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left"
                    style={{
                      border: `1.5px solid ${selected.has(a.id) ? GC.caramel : "rgba(107,79,58,0.15)"}`,
                      background: selected.has(a.id) ? `${GC.caramel}12` : "#fff",
                    }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{
                        borderColor: selected.has(a.id) ? GC.caramel : "rgba(107,79,58,0.3)",
                        background: selected.has(a.id) ? GC.caramel : "transparent",
                      }}>
                      {selected.has(a.id) && <span className="text-white text-[10px] font-black">OK</span>}
                    </div>
                    <span className="flex-1 text-sm font-medium" style={{ color: GC.dark }}>{a.name}</span>
                    <span className="text-sm font-bold" style={{ color: GC.caramel }}>+{brl(a.priceCents)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-between text-sm px-1">
              <span style={{ color: GC.brown }}>Produto</span>
              <span className="flex items-center gap-1.5">
                {product.promotionPriceCents != null && (
                  <span className="text-xs line-through opacity-50" style={{ color: GC.brown }}>{brl(product.priceCents)}</span>
                )}
                <span className="font-bold" style={{ color: product.promotionPriceCents != null ? "#059669" : GC.brown }}>
                  {brl(product.promotionPriceCents ?? product.priceCents)}
                </span>
              </span>
            </div>
            {extraCents > 0 && (
              <div className="flex justify-between text-sm px-1">
                <span style={{ color: GC.brown }}>Total com adicionais</span>
                <span className="font-black" style={{ color: GC.dark }}>{brl((product.promotionPriceCents ?? product.priceCents) + extraCents)}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => handleFlatConfirm([])} disabled={adding}
                className="flex-1 py-2.5 text-sm rounded-2xl font-medium transition hover:opacity-80 disabled:opacity-40"
                style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
                Sem adicionais
              </button>
              <button type="button" disabled={adding} onClick={() => handleFlatConfirm([...selected])}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-2xl transition hover:opacity-90 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
                {adding ? "Adicionando..." : selected.size > 0 ? `Adicionar (${selected.size})` : "Adicionar"}
              </button>
            </div>
          </div>
        )}
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
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [adding, setAdding]       = useState<string | null>(null);
  const [addonTarget, setAddonTarget] = useState<QuickProduct | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;

    async function loadAllProducts() {
      setLoadingInitial(true);
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
            excludeSupplies: "true",
          });


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
        if (!cancelled) setLoadingInitial(false);
      }
    }

    loadAllProducts();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of products) {
      const cat = p.categoryName;
      if (cat && !seen.has(cat)) { seen.add(cat); list.push(cat); }
    }
    return list.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    let base = products;
    if (activeCategory) base = base.filter((p) => p.categoryName === activeCategory);
    if (!q) return base;
    return base.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.internalCode ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [products, searchInput, activeCategory]);

  const categoryItems = useMemo(() => {
    const inferIcon = (name: string | null): LucideIcon => {
      if (!name) return LayoutGrid;
      const n = name.toLocaleLowerCase();
      if (n.includes("quente") || n.includes("cafe") || n.includes("caf") || n.includes("espresso") || n.includes("capuccino")) return Coffee;
      if (n.includes("gelad") || n.includes("ice") || n.includes("frappe") || n.includes("frap") || n.includes("cold")) return Snowflake;
      if (n.includes("salgado") || n.includes("sanduiche") || n.includes("lanche") || n.includes("toast")) return Sandwich;
      if (n.includes("bebida") || n.includes("suco") || n.includes("shake")) return CupSoda;
      return ShoppingBag;
    };

    const inferDescription = (name: string | null): string => {
      if (!name) return "Ver todos os itens";
      const n = name.toLocaleLowerCase();
      if (n.includes("quente") || n.includes("cafe") || n.includes("caf")) return "Cafes e bebidas quentes";
      if (n.includes("gelad") || n.includes("ice") || n.includes("frappe") || n.includes("frap")) return "Refrescantes e gelados";
      if (n.includes("salgado") || n.includes("sanduiche") || n.includes("lanche")) return "Lanches e salgados";
      if (n.includes("doce") || n.includes("torta") || n.includes("brownie")) return "Sobremesas e doces";
      return "Itens desta categoria";
    };

    return [null, ...categories].map((cat) => ({
      key: cat,
      label: cat ?? "Todos",
      icon: inferIcon(cat),
      description: inferDescription(cat),
    }));
  }, [categories]);


  async function handleAdd(p: QuickProduct) {
    if (adding) return;
    if (p.hasAddons) {
      setAddonTarget(p);
      return;
    }
    setAdding(p.id);
    try {
      const override = p.promotionPriceCents ?? undefined;
      await addItem(saleId, { productId: p.id, qty: 1, unitPriceCentsOverride: override });
      onAdded(p.name);
    } finally {
      setAdding(null);
    }
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
      <div className="h-full flex flex-col p-3 gap-2 overflow-hidden" style={{ background: GC.bg }}>
        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: GC.brown, opacity: 0.5 }} />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); }}
            placeholder="Buscar por nome, código ou código de barras"
            className="w-full h-9 rounded-xl pl-8 pr-3 text-xs focus:outline-none"
            style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
          />
          {loadingInitial && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: GC.brown, opacity: 0.5 }}>
              carregando...
            </span>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-3 flex-1 min-h-0">
          {categories.length > 0 && (
            <aside className="hidden lg:flex lg:flex-col lg:min-h-0">
              <div className="rounded-3xl p-2 border h-full overflow-y-auto grid grid-cols-2 gap-1.5 content-start" style={{ background: "#fff", borderColor: "rgba(107,79,58,0.12)" }}>
                {categoryItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === activeCategory;
                  return (
                    <button
                      key={item.key ?? "__all__"}
                      type="button"
                      onClick={() => setActiveCategory(item.key)}
                      className="w-full rounded-2xl px-1.5 py-2.5 transition-all"
                      style={active
                        ? { background: GC.caramel, color: "#fff", boxShadow: `0 10px 24px ${GC.caramel}44` }
                        : { background: GC.cream, color: GC.dark, border: "1px solid rgba(107,79,58,0.1)" }}
                    >
                      <span className="flex flex-col items-center gap-1">
                        <span className="w-7 h-7 rounded-xl grid place-items-center"
                          style={active ? { background: "rgba(255,255,255,0.18)" } : { background: "rgba(200,149,58,0.18)", color: GC.caramel }}>
                          <Icon size={15} />
                        </span>
                        <span className="text-[10px] font-extrabold leading-tight text-center line-clamp-2 w-full px-0.5">{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
          <div className="min-w-0 flex flex-col min-h-0">
            {categories.length > 0 && (
              <div className="lg:hidden flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {categoryItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === activeCategory;
                  return (
                    <button
                      key={item.key ?? "__all__"}
                      type="button"
                      onClick={() => setActiveCategory(item.key)}
                      className="shrink-0 min-w-[150px] rounded-2xl px-3 py-2 flex items-center gap-2 text-xs font-bold"
                      style={active
                        ? { background: GC.caramel, color: "#fff", boxShadow: `0 4px 12px ${GC.caramel}44` }
                        : { background: "#fff", color: GC.brown, border: "1px solid rgba(107,79,58,0.12)" }}
                    >
                      <Icon size={15} />
                      <span className="text-left whitespace-normal break-words leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
            {filteredProducts.length === 0 && !loadingInitial ? (
              <div className="h-full min-h-[220px] flex items-center justify-center text-sm" style={{ color: GC.brown, opacity: 0.4 }}>
                Nenhum produto encontrado
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={adding === p.id || !saleId}
                    onClick={() => handleAdd(p)}
                    className="flex flex-col items-center gap-1 p-2 rounded-2xl transition active:scale-95 text-left disabled:opacity-50 relative hover:shadow-md"
                    style={{
                      background: "#fff",
                      border: `1.5px solid ${p.isBestSeller ? `${GC.caramel}55` : "rgba(107,79,58,0.1)"}`,
                    }}
                  >
                    {p.isBestSeller && (
                      <span className="absolute top-1 left-1 text-[8px] font-bold text-white rounded-full px-1.5 py-px leading-none"
                        style={{ background: GC.caramel }}>
                        Top
                      </span>
                    )}
                    {p.hasAddons && (
                      <span className="absolute top-1 right-1 text-[8px] font-bold text-white rounded-full px-1 py-px leading-none"
                        style={{ background: GC.brown }}>+</span>
                    )}
                    <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center"
                      style={{ background: GC.cream }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-bold" style={{ color: GC.brown, opacity: 0.35 }}>SEM IMAGEM</span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium leading-tight text-center line-clamp-2 w-full" style={{ color: GC.dark }}>
                      {p.name}
                    </span>
                    {p.promotionPriceCents != null ? (
                      <span className="flex flex-col items-center leading-tight">
                        <span className="text-[9px] line-through opacity-50" style={{ color: GC.brown }}>{brl(p.priceCents)}</span>
                        <span className="text-[11px] font-black" style={{ color: "#059669" }}>{brl(p.promotionPriceCents)}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-black" style={{ color: GC.caramel }}>{brl(p.priceCents)}</span>
                    )}
                    {(p.internalCode || p.barcode) && (
                      <span className="text-[10px] leading-tight text-center" style={{ color: GC.brown, opacity: 0.5 }}>
                        {p.internalCode || p.barcode}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
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
    <div className="overflow-auto h-full" style={{ background: GC.bg }}>
      <table className="w-full text-sm table-auto">
        <thead className="sticky top-0 z-10" style={{ background: GC.cream, borderBottom: `1px solid rgba(107,79,58,0.1)` }}>
          <tr className="text-left">
            <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest" style={{ color: GC.brown }}>Produto</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest hidden sm:table-cell" style={{ color: GC.brown }}>Qtd</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest hidden sm:table-cell" style={{ color: GC.brown }}>Unit</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest" style={{ color: GC.brown }}>Total</th>
            <th className="px-3 py-2.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {!sale || sale.items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: GC.brown, opacity: 0.4 }}>
                Nenhum item no carrinho
              </td>
            </tr>
          ) : sale.items.map((item) => (
            <tr key={item.id} className="transition hover:bg-amber-50/40" style={{ borderBottom: `1px solid rgba(107,79,58,0.07)` }}>
              <td className="px-4 py-2.5 font-medium align-top" style={{ color: GC.dark }}>
                <span className="block break-words leading-tight">{item.productNameSnapshot}</span>
                <span className="sm:hidden text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>
                  {item.isSoldByWeight ? `${item.weightKg?.toFixed(3)} kg` : `${item.qty}x`} · {brl(item.unitPriceCentsSnapshot)}
                </span>
                {item.addons && item.addons.length > 0 && (
                  <span className="block mt-0.5 text-[11px]" style={{ color: GC.caramel }}>
                    + {item.addons.map((a) => a.nameSnapshot).join(", ")}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right hidden sm:table-cell" style={{ color: GC.brown }}>
                {item.isSoldByWeight ? `${item.weightKg?.toFixed(3)} kg` : item.qty}
              </td>
              <td className="px-3 py-2.5 text-right hidden sm:table-cell" style={{ color: GC.brown, opacity: 0.7 }}>
                {brl(item.unitPriceCentsSnapshot)}{item.isSoldByWeight && <span className="text-xs">/kg</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-black whitespace-nowrap" style={{ color: GC.dark }}>{brl(item.totalCents)}</td>
              <td className="px-3 py-2.5">
                <button onClick={() => onRemove(item.id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition hover:opacity-80"
                  style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                  <X size={11} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€ Nav Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NAV_ITEMS = [
  { icon: LayoutGrid,  label: "Central",    desc: "Visão geral da operação",    route: "/app"             },
  { icon: ShoppingBag, label: "Pedidos",    desc: "Todos os pedidos em aberto", route: "/app/pedidos"     },
  { icon: Coffee,      label: "Mesas",      desc: "QR Code e comandas",         route: "/app/mesas"       },
  { icon: Headphones,  label: "Atendimento",desc: "Pedidos por telefone",       route: "/app/atendimento" },
];

function NavDrawer({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  function go(route: string) {
    onClose();
    navigate(route);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(28,18,9,0.55)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed left-0 top-0 bottom-0 z-[91] flex flex-col w-72 shadow-2xl"
        style={{ background: GC.bg }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: GC.dark }}
        >
          <div>
            <span className="font-black text-base tracking-tight" style={{ color: GC.caramel }}>
              PDV
            </span>
            <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              Navegação
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:opacity-70"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
          </button>
        </div>

        {/* Section label */}
        <p
          className="px-5 pt-5 pb-2 text-[10px] font-black uppercase tracking-widest"
          style={{ color: GC.brown, opacity: 0.5 }}
        >
          Ir para
        </p>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 pb-6 flex flex-col gap-1">
          {NAV_ITEMS.map(({ icon: Icon, label, desc, route }) => (
            <button
              key={route}
              onClick={() => go(route)}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: GC.cream, border: `1.5px solid rgba(200,149,58,0.15)` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `rgba(200,149,58,0.12)` }}
              >
                <Icon size={18} style={{ color: GC.caramel }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: GC.dark }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>{desc}</p>
              </div>
              <ChevronRight size={14} style={{ color: GC.caramel, opacity: 0.5 }} />
            </button>
          ))}
        </nav>

        {/* Footer hint */}
        <div
          className="px-5 py-4 shrink-0 border-t text-center"
          style={{ borderColor: `rgba(107,79,58,0.12)` }}
        >
          <p className="text-[11px]" style={{ color: GC.brown, opacity: 0.4 }}>
            O caixa permanece aberto ao navegar.
          </p>
        </div>
      </div>
    </>
  );
}

//

// â”€â”€ CustomerSearchModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── LoyaltyRewardItem ─────────────────────────────────────────────────────────
interface LoyaltyRewardItem {
  id: string;
  name: string;
  description: string | null;
  couponCode: string | null;
  loyaltyPointsCost: number;
  type: string;
  value: number;
}

// ── LoyaltyRewardsModal ───────────────────────────────────────────────────────
function LoyaltyRewardsModal({
  customer,
  rewards,
  onApply,
  onClose,
}: {
  customer: PdvCustomer;
  rewards: LoyaltyRewardItem[];
  onApply: (reward: LoyaltyRewardItem) => void;
  onClose: () => void;
}) {
  const fmtDiscount = (r: LoyaltyRewardItem) =>
    r.type === "PercentDiscount"
      ? `${r.value}% OFF`
      : `R$ ${(r.value / 100).toFixed(2)} OFF`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl" style={{ background: GC.bg }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: GC.caramel }}>
            Programa de Fidelidade
          </p>
          <p className="text-lg font-black mt-0.5" style={{ color: GC.dark }}>{customer.name}</p>
          <p className="text-3xl font-black leading-none mt-1" style={{ color: GC.caramel }}>
            {customer.pointsBalance.toLocaleString("pt-BR")}
            <span className="text-base font-semibold ml-1" style={{ color: GC.brown }}>pontos</span>
          </p>
        </div>

        <div>
          <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: GC.brown }}>
            {rewards.length} recompensa{rewards.length !== 1 ? "s" : ""} disponível{rewards.length !== 1 ? "is" : ""}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {rewards.map(r => (
              <div key={r.id} className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                style={{ background: GC.cream, border: `1px solid rgba(200,149,58,0.3)` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: GC.dark }}>{r.name}</p>
                  <p className="text-xs" style={{ color: GC.brown }}>
                    {fmtDiscount(r)}
                    {r.couponCode && <span className="ml-1.5 font-mono font-bold">[{r.couponCode}]</span>}
                  </p>
                  <p className="text-[11px]" style={{ color: GC.caramel }}>
                    Custo: {r.loyaltyPointsCost.toLocaleString("pt-BR")} pts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApply(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0 transition active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${GC.caramel}, #b9822d)` }}
                >
                  Usar
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition hover:bg-black/5"
          style={{ color: GC.brown, border: `1px solid rgba(107,79,58,0.2)` }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// ── CouponRevealModal ─────────────────────────────────────────────────────────
function CouponRevealModal({
  couponCode,
  promotionName,
  onApplyNow,
  onClose,
}: {
  couponCode: string;
  promotionName: string;
  onApplyNow: (code: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(couponCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-3xl p-5 space-y-4 shadow-2xl text-center" style={{ background: GC.bg }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: GC.caramel }}>
            Cupom Resgatado
          </p>
          <p className="text-base font-bold mt-0.5" style={{ color: GC.dark }}>{sanitizeUiText(promotionName)}</p>
        </div>

        <div className="rounded-2xl px-4 py-4 space-y-3" style={{ background: GC.cream, border: `1px solid rgba(200,149,58,0.3)` }}>
          <p className="text-3xl font-black tracking-widest font-mono" style={{ color: GC.caramel }}>
            {couponCode}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2 rounded-xl text-sm font-bold transition active:scale-95"
            style={{
              background: copied ? "#d1fae5" : "white",
              color: copied ? "#065f46" : GC.brown,
              border: `1px solid rgba(107,79,58,0.2)`,
            }}
          >
            {copied ? "✓ Copiado!" : "Copiar código"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 rounded-xl text-sm font-semibold transition hover:bg-black/5"
            style={{ color: GC.brown, border: `1px solid rgba(107,79,58,0.2)` }}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => onApplyNow(couponCode)}
            className="py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95"
            style={{ background: `linear-gradient(135deg, ${GC.caramel}, #b9822d)` }}
          >
            Aplicar agora
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CustomerSearchModal ───────────────────────────────────────────────────────
function CustomerSearchModal({
  onSelect, onSkip, onClose,
}: {
  onSelect: (c: PdvCustomer) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"phone" | "cpf">("phone");
  const [value, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdvCustomer | null | "notfound">(null);

  function applyMask(raw: string) {
    return mode === "cpf" ? maskCpf(raw) : maskPhone(raw);
  }

  function handleModeChange(m: "phone" | "cpf") {
    setMode(m);
    setPhone("");
    setResult(null);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const digits = value.replace(/\D/g, "");
    const minLen = mode === "cpf" ? 11 : 10;
    if (digits.length < minLen) return;
    setLoading(true);
    try {
      const found = await searchCustomer(value);
      setResult(found ?? "notfound");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4"
        style={{ background: "#FAF7F2" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold text-base" style={{ color: "#1C1209" }}>Identificar Cliente</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>

        {/* toggle Telefone / CPF */}
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(107,79,58,0.2)" }}>
          {(["phone", "cpf"] as const).map((m) => (
            <button key={m} type="button"
              onClick={() => handleModeChange(m)}
              className="flex-1 py-1.5 text-xs font-medium transition"
              style={mode === m
                ? { background: "#C8953A", color: "#fff" }
                : { background: "#fff", color: "#6B4F3A" }}>
              {m === "phone" ? "Telefone" : "CPF"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setPhone(applyMask(e.target.value))}
            placeholder={mode === "cpf" ? "000.000.000-00" : "(11) 99999-9999"}
            inputMode="numeric"
            className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ border: "1.5px solid rgba(107,79,58,0.2)", background: "#fff", color: "#1C1209" }}
          />
          <button type="submit" disabled={loading || value.replace(/\D/g,"").length < (mode === "cpf" ? 11 : 10)}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-bold transition active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #1C1209, #3D2314)" }}>
            {loading ? "..." : "Buscar"}
          </button>
        </form>

        {result === "notfound" && (
          <p className="text-sm text-red-500">Nenhum cliente encontrado para o termo informado.</p>
        )}

        {result && result !== "notfound" && (
          <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(107,79,58,0.08)" }}>
            <p className="font-semibold text-sm" style={{ color: "#1C1209" }}>{result.name}</p>
            <p className="text-xs" style={{ color: "#6B4F3A" }}>{result.phone}</p>
            {result.pointsBalance > 0 && (
              <p className="text-xs font-medium" style={{ color: "#C8953A" }}>
                {result.pointsBalance} pontos de fidelidade
              </p>
            )}
            <button
              onClick={() => onSelect(result as PdvCustomer)}
              className="mt-2 w-full py-2 rounded-xl text-white text-sm font-bold transition active:scale-95"
              style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
              Usar este cliente
            </button>
          </div>
        )}

        <button
          onClick={onSkip}
          className="w-full py-2 rounded-xl text-sm transition hover:bg-black/5"
          style={{ color: "#6B4F3A" }}>
          Pular identificação
        </button>
      </div>
    </div>
  );
}

export default function PdvPage() {
  const { session, sale, loading, refreshSession, refreshSale, setSale } = usePdv();
  const [searchParams, setSearchParams] = useSearchParams();

  const [initialized, setInitialized]       = useState(false);
  const [barcode, setBarcode]               = useState("");
  const [scanning, setScanning]             = useState(false);
  const [davCode, setDavCode]               = useState("");
  const [importingDav, setImportingDav]     = useState(false);
  const [showDavSearch, setShowDavSearch]   = useState(false);
  const [paying, setPaying]                 = useState(false);
  const [showPay, setShowPay]               = useState(false);
  const [saleComplete, setSaleComplete]     = useState<{
    saleId: string; publicId: string; totalCents: number;
    changeCents: number; customerPhone: string | null;
  } | null>(null);
  const [pendingCustomer, setPendingCustomer] = useState<PdvCustomer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [feedback, setFeedback]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [movementType, setMovementType]     = useState<"Sangria" | "Suprimento" | null>(null);
  const [navOpen, setNavOpen]               = useState(false);
  const [davPayMethod, setDavPayMethod]     = useState<string | null>(null);
  const [davSuggestedAmountCents, setDavSuggestedAmountCents] = useState<number | null>(null);
  const [appliedCoupon, setAppliedCoupon]   = useState<{
    code: string;
    discountCents: number;
    promotionName: string;
    promotionId: string;
  } | null>(null);
  const [loyaltyRewardsModal, setLoyaltyRewardsModal] = useState<{
    customer: PdvCustomer;
    rewards: LoyaltyRewardItem[];
  } | null>(null);
  const [couponRevealModal, setCouponRevealModal] = useState<{
    couponCode: string;
    promotionName: string;
  } | null>(null);
  const autoDavHandledRef = useRef(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const autoDavCodeParam = searchParams.get("dav") ?? searchParams.get("davCode");

  useEffect(() => {
    refreshSession().then(() => setInitialized(true));
  }, [refreshSession]);

  useEffect(() => {
    if (session && !sale) {
      handleNewSale();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    setAppliedCoupon(null);
  }, [sale?.id, sale?.subtotalCents, sale?.items.length]);

  const flash = useCallback((msg: string, ok: boolean) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 2500);
  }, []);
  const normalizeDavCode = useCallback((rawCode: string) => {
    const normalized = rawCode.trim().toUpperCase();
    return normalized.startsWith("DAV-") ? normalized : `DAV-${normalized}`;
  }, []);

  useEffect(() => {
    if (!autoDavCodeParam) return;
    const displayCode = autoDavCodeParam.trim().toUpperCase().replace(/^DAV-/, "");
    if (displayCode) setDavCode(displayCode);
  }, [autoDavCodeParam]);

  async function handleNewSale(customer?: PdvCustomer | null) {
    if (!session) return;
    try {
      setDavPayMethod(null);
      setDavSuggestedAmountCents(null);
      const c = customer ?? pendingCustomer;
      const created = await createSale({
        cashSessionId: session.id,
        ...(c ? { customerId: c.id, customerName: c.name, customerPhone: c.phone ?? undefined } : {}),
      });
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
      flash(e instanceof Error ? e.message : "Produto nao encontrado", false);
    } finally {
      setScanning(false);
    }
  }

  function mapDavPayMethod(m: string | null): string | null {
    if (!m) return null;
    const map: Record<string, string> = { PIX: "PIX", CASH: "DINHEIRO", CARD: "CARTAO_CREDITO" };
    return map[m.toUpperCase()] ?? m;
  }

  async function handleImportDav(e: React.FormEvent) {
    e.preventDefault();
    if (!sale || !davCode.trim()) return;
    setImportingDav(true);
    const code = normalizeDavCode(davCode);
    try {
      const res = await importDav(sale.id, code);
      await refreshSale(sale.id);
      if (res.paymentMethod) setDavPayMethod(mapDavPayMethod(res.paymentMethod));
      if (res.suggestedAmountCents > 0) setDavSuggestedAmountCents(res.suggestedAmountCents);
      flash(`DAV ${res.publicId} importado (${res.itemsAdded} item${res.itemsAdded !== 1 ? "s" : ""})`, true);
      setDavCode("");
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "DAV nao encontrado", false);
    } finally {
      setImportingDav(false);
    }
  }

  useEffect(() => {
    if (!session || !sale || !autoDavCodeParam || autoDavHandledRef.current) return;
    autoDavHandledRef.current = true;

    const code = normalizeDavCode(autoDavCodeParam);

    const run = async () => {
      setImportingDav(true);
      try {
        const res = await importDav(sale.id, code);
        await refreshSale(sale.id);
        if (res.paymentMethod) setDavPayMethod(mapDavPayMethod(res.paymentMethod));
        if (res.suggestedAmountCents > 0) setDavSuggestedAmountCents(res.suggestedAmountCents);
        flash(`DAV ${res.publicId} importado (${res.itemsAdded} item${res.itemsAdded !== 1 ? "s" : ""})`, true);
        setDavCode("");
      } catch (e: unknown) {
        flash(e instanceof Error ? e.message : "DAV nao encontrado", false);
      } finally {
        setImportingDav(false);
        const next = new URLSearchParams(searchParams);
        next.delete("dav");
        next.delete("davCode");
        next.delete("autoImport");
        setSearchParams(next, { replace: true });
      }
    };

    void run();
  }, [
    session,
    sale,
    autoDavCodeParam,
    normalizeDavCode,
    refreshSale,
    flash,
    searchParams,
    setSearchParams,
  ]);

  async function handleRemoveItem(itemId: string) {
    if (!sale) return;
    await removeItem(sale.id, itemId);
    await refreshSale(sale.id);
  }

  async function handleApplyCoupon(code: string) {
    if (!sale) return;
    const normalized = code.trim().toUpperCase();
    const results = await evaluateSalePromotions(sale.id, normalized);
    const couponResults = results.filter(
      (r) => (r.couponCode ?? "").toUpperCase() === normalized
    );
    if (couponResults.length === 0) {
      throw new Error("Cupom inválido, expirado ou não aplicável aos itens da venda.");
    }

    const best = couponResults.sort((a, b) => b.discountCents - a.discountCents)[0];
    setAppliedCoupon({
      code: normalized,
      discountCents: best.discountCents,
      promotionName: best.name,
      promotionId: best.id,
    });
    flash(`Cupom ${normalized} aplicado (-${brl(best.discountCents)})`, true);
  }

  function handleRemoveCoupon() {
    if (!appliedCoupon) return;
    flash(`Cupom ${appliedCoupon.code} removido`, true);
    setAppliedCoupon(null);
  }

  async function handlePay(method: string, amountCents: number, customerDocument?: string, customerCpfForLoyalty?: string) {
    if (!sale) return;
    const discountCents = Math.max(sale.discountCents, appliedCoupon?.discountCents ?? 0);
    const totalToPayCents = Math.max(0, sale.subtotalCents - discountCents);

    if (amountCents < totalToPayCents) {
      flash(`Valor insuficiente. Total: ${brl(totalToPayCents)}`, false);
      return;
    }
    setPaying(true);
    const saleId      = sale.id;
    const salePhone   = sale.customerPhone;
    try {
      const result = await paySale(saleId, {
        payments: [{ paymentMethod: method, amountCents }],
        discountCents,
        customerDocument,
        customerCpfForLoyalty,
        couponCode: appliedCoupon?.code,
      });
      setShowPay(false);
      setDavPayMethod(null);
      setDavSuggestedAmountCents(null);
      setAppliedCoupon(null);
      setSaleComplete({
        saleId,
        publicId:    result.publicId,
        totalCents:  result.totalCents,
        changeCents: result.changeCents,
        customerPhone: salePhone ?? null,
      });
      if (result.earnedPoints > 0) flash(`+${result.earnedPoints} pontos de fidelidade acumulados!`, true);
      if (result.spentPoints > 0) flash(`-${result.spentPoints} pontos debitados pelo cupom`, true);
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: GC.bg }}>
        <p className="text-sm" style={{ color: GC.brown }}>Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <OpenSessionPage onOpened={() => refreshSession()} />;
  }

  const currentSale = sale as Sale | null;
  const effectiveDiscountCents = Math.max(currentSale?.discountCents ?? 0, appliedCoupon?.discountCents ?? 0);
  const effectiveTotalCents = Math.max(0, (currentSale?.subtotalCents ?? 0) - effectiveDiscountCents);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: GC.bg }}>
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

      {loyaltyRewardsModal && (
        <LoyaltyRewardsModal
          customer={loyaltyRewardsModal.customer}
          rewards={loyaltyRewardsModal.rewards}
          onApply={(reward) => {
            setLoyaltyRewardsModal(null);
            if (reward.couponCode) {
              setCouponRevealModal({ couponCode: reward.couponCode, promotionName: reward.name });
            }
          }}
          onClose={() => setLoyaltyRewardsModal(null)}
        />
      )}
      {couponRevealModal && (
        <CouponRevealModal
          couponCode={couponRevealModal.couponCode}
          promotionName={couponRevealModal.promotionName}
          onApplyNow={async (code) => {
            setCouponRevealModal(null);
            await handleApplyCoupon(code);
          }}
          onClose={() => setCouponRevealModal(null)}
        />
      )}

      {/* Nav Drawer */}
      {navOpen && <NavDrawer onClose={() => setNavOpen(false)} />}

      {/* Top Bar */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]"
        style={{ background: GC.dark, boxShadow: "0 2px 12px rgba(28,18,9,0.25)" }}>
        {/* Menu button */}
        <button
          onClick={() => setNavOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-80 shrink-0"
          style={{ background: "rgba(255,255,255,0.09)" }}
          title="Navegar"
        >
          <Menu size={17} style={{ color: "rgba(255,255,255,0.75)" }} />
        </button>
        <div>
          <span className="font-black text-base tracking-tight" style={{ color: GC.caramel }}>PDV</span>
          <span className="text-sm ml-2 font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{session.registerName}</span>
          <span className="hidden sm:inline text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            · {session.openedByUserName}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setMovementType("Sangria")}
            className="text-xs px-3 py-1.5 rounded-full font-bold transition hover:opacity-80 whitespace-nowrap"
            style={{ background: "rgba(220,38,38,0.18)", color: "#f87171" }}>
            Sangria
          </button>
          <button onClick={() => setMovementType("Suprimento")}
            className="text-xs px-3 py-1.5 rounded-full font-bold transition hover:opacity-80 whitespace-nowrap"
            style={{ background: "rgba(5,150,105,0.18)", color: "#34d399" }}>
            Suprimento
          </button>
          <button onClick={() => setShowCloseModal(true)}
            className="text-xs px-3 py-1.5 rounded-full font-bold transition hover:opacity-80 whitespace-nowrap"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            Fechar Caixa
          </button>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl z-40 transition ${
          feedback.ok ? "bg-green-600" : "bg-red-600"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Post-sale modal */}
      {saleComplete && (
        <SaleCompleteModal
          {...saleComplete}
          onClose={async () => {
            setSaleComplete(null);
            setSale(null);
            setPendingCustomer(null);
            await handleNewSale(null);
          }}
        />
      )}

      {showCustomerSearch && (
        <CustomerSearchModal
          onSelect={async (c) => {
            setPendingCustomer(c);
            setShowCustomerSearch(false);
            // Vincular o cliente ao sale ja aberto (se existir)
            if (sale) {
              try {
                await patchSaleCustomer(sale.id, { customerId: c.id, customerName: c.name, customerPhone: c.phone ?? undefined });
                await refreshSale(sale.id);
              } catch { /* nao bloqueia */ }
            }
            if (c.pointsBalance > 0) {
              try {
                const all = await adminFetch<Array<{
                  id: string; name: string; description: string | null;
                  couponCode: string | null; loyaltyPointsCost: number | null;
                  type: string; value: number;
                }>>("/admin/promotions?active=true");
                const available = all.filter(
                  p => p.loyaltyPointsCost != null &&
                       p.loyaltyPointsCost > 0 &&
                       p.loyaltyPointsCost <= c.pointsBalance
                ).map(p => ({ ...p, loyaltyPointsCost: p.loyaltyPointsCost! }));
                if (available.length > 0) {
                  setLoyaltyRewardsModal({ customer: c, rewards: available });
                }
              } catch { /* silencioso */ }
            }
          }}
          onSkip={() => {
            setPendingCustomer(null);
            setShowCustomerSearch(false);
          }}
          onClose={() => setShowCustomerSearch(false)}
        />
      )}

      {/* Mobile: Payment panel overlay */}
      {showPay && (
        <div className="lg:hidden fixed inset-0 z-30 flex items-end" onClick={() => setShowPay(false)}
          style={{ backgroundColor: "rgba(28,18,9,0.65)" }}>
          <div className="w-full rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: GC.bg }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: GC.cream }} />
            <div className="space-y-1">
              <div className="flex justify-between text-sm" style={{ color: GC.brown }}>
                <span>Subtotal</span><span>{brl(currentSale?.subtotalCents ?? 0)}</span>
              </div>
              {effectiveDiscountCents > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Desconto</span><span>-{brl(effectiveDiscountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-black pt-2 mt-1"
                style={{ color: GC.dark, borderTop: `1px solid rgba(107,79,58,0.12)` }}>
                <span>Total</span><span>{brl(effectiveTotalCents)}</span>
              </div>
            </div>
            <PayPanel
              saleId={currentSale?.id ?? ""}
              subtotalCents={currentSale?.subtotalCents ?? 0}
              baseDiscountCents={currentSale?.discountCents ?? 0}
              totalCents={effectiveTotalCents}
              appliedCoupon={appliedCoupon}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              onPay={handlePay}
              onCancel={handleCancelSale}
              paying={paying}
              defaultMethod={davPayMethod}
              defaultAmountCents={davSuggestedAmountCents}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-3 p-3 sm:p-4 min-h-0">
        {/* Left: Barcode + products */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Cliente identificado */}
          {pendingCustomer && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{ background: "rgba(107,79,58,0.08)", border: `1px solid rgba(107,79,58,0.15)` }}>
              <span className="text-lg"><User size={16} /></span>
              <span className="flex-1 font-medium truncate" style={{ color: GC.dark }}>
                {pendingCustomer.name}
                {pendingCustomer.pointsBalance > 0 && (
                  <span className="ml-2 text-xs font-normal" style={{ color: GC.caramel }}>
                    {pendingCustomer.pointsBalance} pts
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setPendingCustomer(null)}
                className="text-xs px-2 py-0.5 rounded-lg transition hover:bg-white/50"
                style={{ color: GC.brown }}
              >
                Remover
              </button>
            </div>
          )}

          <form onSubmit={handleScan} className="flex gap-2">
            <input
              ref={barcodeRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Codigo de barras..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: "#fff", color: GC.dark }}
            />
            <button type="submit" disabled={scanning || !barcode.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold transition active:scale-95 disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
              {scanning ? "..." : "Ler"}
            </button>
            <button
              type="button"
              title="Identificar cliente"
              onClick={() => setShowCustomerSearch(true)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
              style={{ background: "rgba(107,79,58,0.1)", color: GC.brown }}
            >
              <User size={15} />
            </button>
          </form>

          {/* DAV Import */}
          <form onSubmit={handleImportDav} className="flex gap-2 items-center">
            <div className="flex-1 flex items-center rounded-xl overflow-hidden"
              style={{ border: `1.5px solid rgba(200,149,58,0.35)`, background: "#fff" }}>
              <span className="pl-3 pr-1 text-xs font-black select-none whitespace-nowrap" style={{ color: GC.caramel }}>DAV-</span>
              <input
                value={davCode}
                onChange={(e) => setDavCode(e.target.value.replace(/^DAV-/i, ""))}
                placeholder="código ou escaneie..."
                className="flex-1 py-2.5 pr-3 text-sm bg-transparent focus:outline-none"
                style={{ color: GC.dark }}
              />
            </div>
            <button type="submit" disabled={importingDav || !davCode.trim()}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
              style={{ background: `linear-gradient(135deg, #059669, #047857)` }}>
              {importingDav ? "..." : "Importar"}
            </button>
            <button type="button" title="Buscar orcamento" onClick={() => setShowDavSearch(true)}
              className="p-2.5 rounded-xl transition hover:opacity-80"
              style={{ border: `1.5px solid rgba(200,149,58,0.35)`, color: GC.caramel, background: `${GC.caramel}10` }}>
              <Search size={16} />
            </button>
          </form>

          <div className="rounded-2xl overflow-hidden flex flex-col shadow-sm" style={{ minHeight: 200, flex: "1 1 0", border: `1px solid rgba(107,79,58,0.1)` }}>
            <QuickProducts
              saleId={currentSale?.id ?? ""}
              onAdded={async (name) => {
                if (currentSale) await refreshSale(currentSale.id);
                flash(`${name} adicionado`, true);
                barcodeRef.current?.focus();
              }}
            />
          </div>

          <div className="lg:hidden rounded-2xl overflow-hidden shadow-sm max-h-[320px]"
            style={{ minHeight: 180, border: `1px solid rgba(107,79,58,0.1)` }}>
            <CartTable sale={currentSale} onRemove={handleRemoveItem} />
          </div>

          {/* Mobile: sticky cobrar bar */}
          <div className="lg:hidden">
            <div className="rounded-2xl p-4 flex items-center gap-4 shadow-sm"
              style={{ background: GC.cream, border: `1px solid rgba(107,79,58,0.12)` }}>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GC.brown }}>Total</div>
                <div className="text-2xl font-black" style={{ color: GC.dark }}>{brl(effectiveTotalCents)}</div>
                {currentSale?.publicId && (
                  <div className="text-[10px] mt-0.5" style={{ color: GC.brown, opacity: 0.5 }}>{currentSale.publicId}</div>
                )}
              </div>
              <button
                disabled={!currentSale || currentSale.items.length === 0}
                onClick={() => setShowPay(true)}
                className="shrink-0 px-6 py-3 rounded-2xl text-white font-bold transition active:scale-95 disabled:opacity-40 text-base"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 14px rgba(28,18,9,0.25)" }}
              >
                Cobrar
              </button>
            </div>
          </div>
        </div>

        {/* Right: Totals + Payment (desktop) */}
        <div className="hidden lg:flex w-[420px] xl:w-[460px] flex-col gap-3 shrink-0">
          <div className="rounded-2xl p-5 space-y-3 shadow-sm"
            style={{ background: GC.cream, border: `1px solid rgba(107,79,58,0.1)` }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: GC.brown }}>Resumo da venda</p>
            <div className="flex justify-between text-sm" style={{ color: GC.brown }}>
              <span>Subtotal</span>
              <span>{brl(currentSale?.subtotalCents ?? 0)}</span>
            </div>
            {effectiveDiscountCents > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Desconto</span>
                <span>-{brl(effectiveDiscountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-black pt-2"
              style={{ color: GC.dark, borderTop: `1px solid rgba(107,79,58,0.12)` }}>
              <span>Total</span>
              <span>{brl(effectiveTotalCents)}</span>
            </div>

            {!showPay ? (
              <button
                disabled={!currentSale || currentSale.items.length === 0}
                onClick={() => setShowPay(true)}
                className="w-full py-4 rounded-2xl text-white font-bold text-lg transition active:scale-95 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 18px rgba(28,18,9,0.3)" }}
              >
                Cobrar
              </button>
            ) : (
              <PayPanel
                saleId={currentSale?.id ?? ""}
                subtotalCents={currentSale?.subtotalCents ?? 0}
                baseDiscountCents={currentSale?.discountCents ?? 0}
                totalCents={effectiveTotalCents}
                appliedCoupon={appliedCoupon}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                onPay={handlePay}
                onCancel={handleCancelSale}
                paying={paying}
                defaultMethod={davPayMethod}
                defaultAmountCents={davSuggestedAmountCents}
              />
            )}
            {currentSale?.publicId && (
              <p className="text-center text-[10px]" style={{ color: GC.brown, opacity: 0.5 }}>{currentSale.publicId}</p>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden shadow-sm flex-1 min-h-[340px]"
            style={{ border: `1px solid rgba(107,79,58,0.1)` }}>
            <CartTable sale={currentSale} onRemove={handleRemoveItem} />
          </div>
        </div>
      </div>
    </div>
  );
}



