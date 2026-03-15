import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { ProductSearchInput } from "@/components/ui/ProductSearchInput";
import type { ProductListItem } from "@/features/admin/products/api";
import { Trash2, Plus, Minus, Printer, ArrowLeft, FileText, User, Package } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  barcode: string | null;
  internalCode: string | null;
  priceCents: number;
  qty: number;
  totalCents: number;
  unit: string;
}

// ── Coupon HTML ───────────────────────────────────────────────────────────────

function buildCouponHtml(publicId: string, items: CartItem[], totalCents: number, customerName: string): string {
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = new Date().toLocaleString("pt-BR");

  const itemRows = items.map((i) => `
    <tr>
      <td style="padding:3px 0;font-size:11px;font-weight:600" colspan="3">${i.name}</td>
    </tr>
    <tr style="color:#555">
      <td style="font-size:11px;padding-bottom:3px">${i.qty} ${i.unit}</td>
      <td style="font-size:11px;text-align:right">${fmt(i.priceCents)}</td>
      <td style="font-size:11px;text-align:right;font-weight:bold;color:#111">${fmt(i.totalCents)}</td>
    </tr>
    <tr><td colspan="3"><hr style="border:none;border-top:1px dashed #ddd;margin:2px 0"></td></tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento ${publicId}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; width:80mm; padding:6px 8px 12px; font-size:12px; }
  .center { text-align:center; }
  .title { font-size:14px; font-weight:bold; text-align:center; letter-spacing:1px; margin-bottom:2px; }
  .subtitle { font-size:10px; text-align:center; color:#555; margin-bottom:2px; }
  .sep-solid { border:none; border-top:2px solid #000; margin:5px 0; }
  .sep-dashed { border:none; border-top:1px dashed #aaa; margin:5px 0; }
  table { width:100%; border-collapse:collapse; }
  thead th { font-size:10px; text-transform:uppercase; padding-bottom:3px; }
  .total-row { font-size:13px; font-weight:bold; }
  .barcode-section { margin-top:8px; text-align:center; }
  .barcode-label { font-size:9px; color:#555; margin-bottom:2px; }
  svg { display:block; margin:0 auto; }
  @media print { @page { margin:0; } body { padding:4px; } }
</style>
</head>
<body>

<p class="title">ORÇAMENTO DE BALCÃO</p>
<p class="subtitle">DAV — Documento Auxiliar de Venda</p>
<p class="subtitle">${date}</p>
${customerName ? `<p class="subtitle">Cliente: <strong>${customerName}</strong></p>` : ""}

<hr class="sep-solid">

<table>
  <thead>
    <tr>
      <th style="text-align:left">Descrição / Qtd</th>
      <th style="text-align:right">Unit.</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<hr class="sep-solid">

<table>
  <tr class="total-row">
    <td>TOTAL A PAGAR</td>
    <td colspan="2" style="text-align:right">${fmt(totalCents)}</td>
  </tr>
</table>

<hr class="sep-dashed" style="margin-top:8px">
<p style="font-size:9px;text-align:center;color:#444">Apresente este orçamento no caixa.</p>
<p style="font-size:9px;text-align:center;color:#444">Escaneie o código abaixo para importar no PDV.</p>

<div class="barcode-section">
  <p class="barcode-label">Código do orçamento</p>
  <svg id="barcode"></svg>
  <p style="font-size:10px;font-weight:bold;letter-spacing:1px;margin-top:3px">${publicId}</p>
</div>

<script>
  JsBarcode("#barcode", "${publicId}", {
    format: "CODE128",
    width: 1.4,
    height: 45,
    fontSize: 0,
    margin: 6,
    displayValue: false
  });
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DavBuilderPage() {
  const navigate = useNavigate();
  const [items, setItems]               = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const subtotal = items.reduce((s, i) => s + i.totalCents, 0);
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function addProduct(p: ProductListItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id
            ? { ...i, qty: i.qty + 1, totalCents: (i.qty + 1) * i.priceCents }
            : i
        );
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        barcode: p.barcode,
        internalCode: p.internalCode,
        priceCents: p.priceCents,
        qty: 1,
        totalCents: p.priceCents,
        unit: p.unit,
      }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId
            ? { ...i, qty: i.qty + delta, totalCents: (i.qty + delta) * i.priceCents }
            : i
        )
        .filter((i) => i.qty > 0)
    );
  }

  function setQty(productId: string, qty: number) {
    if (isNaN(qty) || qty <= 0) { removeItem(productId); return; }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, qty, totalCents: qty * i.priceCents }
          : i
      )
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function handleGenerate() {
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        customerName: customerName.trim() || undefined,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      };
      const res = await adminFetch<{ id: string; publicId: string }>("/admin/dav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const html = buildCouponHtml(res.publicId, items, subtotal, customerName);
      const win = window.open("", "_blank", "width=420,height=720");
      if (win) { win.document.write(html); win.document.close(); }

      setItems([]);
      setCustomerName("");
      navigate(`/app/dav?novo=${res.publicId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao gerar orçamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-0">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/app/dav")}
            className="w-9 h-9 flex items-center justify-center rounded-xl border transition hover:bg-gray-100"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}>
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--text)" }}>Novo Orçamento</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>DAV — Documento Auxiliar de Venda</p>
            </div>
          </div>
        </div>

        {/* ── Card: Busca ────────────────────────────────────────────── */}
        <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Package size={14} style={{ color: "#7c5cf8" }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Adicionar Produto</span>
          </div>
          <ProductSearchInput onSelect={addProduct} autoFocus />
        </div>

        {/* ── Card: Itens ────────────────────────────────────────────── */}
        <div className="rounded-2xl border mb-4 overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Itens do Orçamento
            </span>
            {items.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#7c5cf8]/10 text-[#7c5cf8]">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--surface-2)" }}>
                <Package size={18} style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Busque produtos acima para adicionar.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                  <tr className="text-xs font-semibold uppercase tracking-wide text-left" style={{ color: "var(--text-muted)" }}>
                    <th className="px-4 py-2.5">Produto</th>
                    <th className="px-3 py-2.5 text-center">Qtd</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.productId}
                      className={`border-b last:border-0`}
                      style={{ borderColor: "var(--border)", backgroundColor: idx % 2 === 0 ? "transparent" : "var(--surface-2)" }}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-sm leading-tight" style={{ color: "var(--text)" }}>{item.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {fmt(item.priceCents)} / {item.unit}
                          {item.internalCode && <span className="ml-1">· #{item.internalCode}</span>}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => updateQty(item.productId, -1)}
                            className="w-6 h-6 rounded-lg border flex items-center justify-center transition hover:bg-red-50 hover:border-red-300 hover:text-red-500 shrink-0"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                          >
                            <Minus size={9} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) => setQty(item.productId, parseInt(e.target.value, 10))}
                            className="w-12 text-center font-bold text-sm border rounded-lg px-1 py-1 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
                            style={{ borderColor: "var(--border)", color: "var(--text)", backgroundColor: "var(--bg)" }}
                          />
                          <button
                            onClick={() => updateQty(item.productId, +1)}
                            className="w-6 h-6 rounded-lg border flex items-center justify-center transition hover:bg-green-50 hover:border-green-300 hover:text-green-600 shrink-0"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                          >
                            <Plus size={9} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{fmt(item.totalCents)}</span>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total bar */}
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total do Orçamento</span>
                <span className="text-xl font-bold" style={{ color: "#7c5cf8" }}>{fmt(subtotal)}</span>
              </div>
            </>
          )}
        </div>

        {/* ── Card: Cliente ──────────────────────────────────────────── */}
        <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-3">
            <User size={14} style={{ color: "#7c5cf8" }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Identificação (opcional)</span>
          </div>
          <input
            className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
            style={{ borderColor: "var(--border)" }}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nome do cliente"
          />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 mb-4">
            {error}
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/app/dav")}
            className="flex-1 py-3 text-sm font-semibold border rounded-xl transition hover:bg-gray-50"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Cancelar
          </button>
          <button
            disabled={items.length === 0 || saving}
            onClick={handleGenerate}
            className="flex-1 py-3 text-sm font-bold rounded-xl text-white transition hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
          >
            <Printer size={15} />
            {saving ? "Gerando…" : `Gerar Orçamento${items.length > 0 ? ` (${items.length})` : ""}`}
          </button>
        </div>
      </main>
    </div>
  );
}
