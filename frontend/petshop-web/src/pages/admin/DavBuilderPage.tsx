import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { ProductSearchInput } from "@/components/ui/ProductSearchInput";
import type { ProductListItem } from "@/features/admin/products/api";
import { Trash2, Plus, Minus, Printer, ArrowLeft } from "lucide-react";

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
      <td style="padding:2px 0;font-size:11px" colspan="4">${i.name}</td>
    </tr>
    <tr>
      <td style="font-size:11px;color:#666">${i.qty} ${i.unit}</td>
      <td style="font-size:11px;color:#666;text-align:right">${fmt(i.priceCents)}</td>
      <td style="font-size:11px;text-align:right;font-weight:bold">${fmt(i.totalCents)}</td>
    </tr>
  `).join("<tr><td colspan='3'><hr style='border:none;border-top:1px dashed #ccc;margin:1px 0'></td></tr>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento ${publicId}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:monospace; width:80mm; padding:8px; font-size:12px; }
  h1 { font-size:13px; text-align:center; margin-bottom:4px; }
  .sub { font-size:10px; text-align:center; color:#555; }
  table { width:100%; border-collapse:collapse; }
  .total-row td { font-size:13px; font-weight:bold; padding-top:4px; }
  svg { display:block; margin:8px auto 0; }
  @media print { @page { margin:0; } }
</style>
</head>
<body>
<h1>ORÇAMENTO DE BALCÃO</h1>
<p class="sub">${date}</p>
${customerName ? `<p class="sub">Cliente: ${customerName}</p>` : ""}
<hr style="border:none;border-top:2px solid #000;margin:4px 0">

<table>
  <thead>
    <tr>
      <th style="font-size:10px;text-align:left">Qtd</th>
      <th style="font-size:10px;text-align:right">Unit.</th>
      <th style="font-size:10px;text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<hr style="border:none;border-top:2px solid #000;margin:4px 0">
<table>
  <tr class="total-row">
    <td>TOTAL</td>
    <td style="text-align:right">${fmt(totalCents)}</td>
  </tr>
</table>

<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">
<p style="font-size:10px;text-align:center">Escaneie o código para importar no PDV</p>
<p style="font-size:10px;text-align:center;font-weight:bold">${publicId}</p>
<svg id="barcode"></svg>

<script>
  JsBarcode("#barcode", "${publicId}", {
    format:"CODE128", width:1.5, height:40, fontSize:10,
    margin:4, displayValue:false
  });
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DavBuilderPage() {
  const navigate = useNavigate();
  const [items, setItems]             = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

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

      // Open coupon in new window
      const html = buildCouponHtml(res.publicId, items, subtotal, customerName);
      const win = window.open("", "_blank", "width=400,height=700");
      if (win) {
        win.document.write(html);
        win.document.close();
      }

      // Reset form
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
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app/dav")} className="p-2 rounded-xl hover:bg-gray-100 transition" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Novo Orçamento (DAV)</h1>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Adicionar produto</label>
          <ProductSearchInput onSelect={addProduct} autoFocus />
        </div>

        {/* Items */}
        {items.length > 0 ? (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <table className="w-full text-sm">
              <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                <tr className="text-xs font-bold uppercase tracking-wide text-left" style={{ color: "var(--text-muted)" }}>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-3 py-3 text-center">Qtd</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{item.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmt(item.priceCents)} / {item.unit}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-50 transition"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-8 text-center font-semibold text-sm" style={{ color: "var(--text)" }}>{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.productId, +1)}
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-50 transition"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-sm" style={{ color: "var(--text)" }}>
                      {fmt(item.totalCents)}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 transition">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold" style={{ color: "var(--text)" }}>TOTAL</td>
                  <td colSpan={2} className="px-3 py-3 text-right text-base font-bold" style={{ color: "#7c5cf8" }}>{fmt(subtotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 rounded-2xl border border-dashed" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Busque produtos acima para adicionar ao orçamento.</p>
          </div>
        )}

        {/* Customer name (optional) */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Nome do cliente (opcional)</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ex: João da Silva"
          />
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/app/dav")}
            className="flex-1 py-3 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            style={{ color: "var(--text)" }}
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
            {saving ? "Gerando..." : "Gerar Orçamento"}
          </button>
        </div>
      </main>
    </div>
  );
}
