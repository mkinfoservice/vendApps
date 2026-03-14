import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Loader2, Plus, Printer, CheckCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DavListItem {
  id: string;
  publicId: string;
  customerName: string;
  totalCents: number;
  status: string;
  itemCount: number;
  createdAtUtc: string;
}

interface DavListResponse {
  total: number;
  items: DavListItem[];
}

function fetchTodayDavs(): Promise<DavListResponse> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return adminFetch<DavListResponse>(
    `/admin/dav?origin=Manual&pageSize=50&from=${from.toISOString()}`
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  Draft:                       { label: "Rascunho",       cls: "bg-gray-100 text-gray-600" },
  AwaitingFiscalConfirmation:  { label: "Ag. Fiscal",     cls: "bg-yellow-100 text-yellow-700" },
  FiscalConfirmed:             { label: "Fiscal OK",      cls: "bg-green-100 text-green-700" },
  Converted:                   { label: "Convertido",     cls: "bg-purple-100 text-purple-700" },
  Cancelled:                   { label: "Cancelado",      cls: "bg-red-100 text-red-600" },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DavListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const newPublicId = searchParams.get("novo");
  const [showBanner, setShowBanner] = useState(!!newPublicId);

  useEffect(() => {
    if (showBanner) {
      const t = setTimeout(() => setShowBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showBanner]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dav-today"],
    queryFn: fetchTodayDavs,
    refetchInterval: 30_000,
  });

  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Orçamentos (DAV)</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Orçamentos gerados hoje</p>
          </div>
          <button
            onClick={() => navigate("/app/dav/novo")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
          >
            <Plus size={15} /> Novo Orçamento
          </button>
        </div>

        {/* Success banner */}
        {showBanner && newPublicId && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm">
            <CheckCircle size={16} className="shrink-0" />
            <span>Orçamento <strong>{newPublicId}</strong> gerado com sucesso. Escaneie o código de barras no PDV para importar.</span>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum orçamento gerado hoje.</p>
            <button
              onClick={() => navigate("/app/dav/novo")}
              className="mt-4 px-4 py-2 text-sm font-semibold rounded-xl text-white transition hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
            >
              Criar primeiro orçamento
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <table className="w-full text-sm">
              <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                <tr className="text-left text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Cliente</th>
                  <th className="px-4 py-3 hidden md:table-cell text-center">Itens</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Hora</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((d) => {
                  const st = STATUS_LABELS[d.status] ?? { label: d.status, cls: "bg-gray-100 text-gray-500" };
                  const time = new Date(d.createdAtUtc).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr
                      key={d.id}
                      className="border-t transition"
                      style={{ borderColor: "var(--border)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "")}
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-xs" style={{ color: "#7c5cf8" }}>{d.publicId}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: "var(--text-muted)" }}>{d.customerName || "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-center text-xs" style={{ color: "var(--text-muted)" }}>{d.itemCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sm" style={{ color: "var(--text)" }}>{fmt(d.totalCents)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: "var(--text-muted)" }}>{time}</td>
                      <td className="px-4 py-3">
                        <button
                          title="Re-imprimir cupom"
                          onClick={() => {
                            // Re-print: fetch detail then open coupon
                            adminFetch<{ publicId: string; totalCents: number; customerName: string; items: { productNameSnapshot: string; qty: number; unitPriceCentsSnapshot: number; totalCents: number }[] }>(`/admin/dav/${d.id}`)
                              .then((q) => {
                                const html = buildReprintHtml(q.publicId, q.items, q.totalCents, q.customerName);
                                const win = window.open("", "_blank", "width=400,height=700");
                                if (win) { win.document.write(html); win.document.close(); }
                              })
                              .catch(() => alert("Erro ao buscar orçamento."));
                          }}
                          className="transition"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-right">
          <button onClick={() => refetch()} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
            Atualizar lista
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Reprint helper ────────────────────────────────────────────────────────────

function buildReprintHtml(
  publicId: string,
  items: { productNameSnapshot: string; qty: number; unitPriceCentsSnapshot: number; totalCents: number }[],
  totalCents: number,
  customerName: string
): string {
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = new Date().toLocaleString("pt-BR");

  const itemRows = items.map((i) => `
    <tr><td style="font-size:11px" colspan="3">${i.productNameSnapshot}</td></tr>
    <tr>
      <td style="font-size:11px;color:#666">${i.qty} un</td>
      <td style="font-size:11px;color:#666;text-align:right">${fmt(i.unitPriceCentsSnapshot)}</td>
      <td style="font-size:11px;text-align:right;font-weight:bold">${fmt(i.totalCents)}</td>
    </tr>
    <tr><td colspan="3"><hr style="border:none;border-top:1px dashed #ccc;margin:1px 0"></td></tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento ${publicId}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:monospace;width:80mm;padding:8px;font-size:12px}
  h1{font-size:13px;text-align:center;margin-bottom:4px}
  .sub{font-size:10px;text-align:center;color:#555}
  table{width:100%;border-collapse:collapse}
  .total-row td{font-size:13px;font-weight:bold;padding-top:4px}
  svg{display:block;margin:8px auto 0}
  @media print{@page{margin:0}}
</style>
</head>
<body>
<h1>ORÇAMENTO DE BALCÃO</h1>
<p class="sub">${date}${customerName ? ` · ${customerName}` : ""}</p>
<hr style="border:none;border-top:2px solid #000;margin:4px 0">
<table><thead><tr>
  <th style="font-size:10px;text-align:left">Qtd</th>
  <th style="font-size:10px;text-align:right">Unit.</th>
  <th style="font-size:10px;text-align:right">Total</th>
</tr></thead><tbody>${itemRows}</tbody></table>
<hr style="border:none;border-top:2px solid #000;margin:4px 0">
<table><tr class="total-row">
  <td>TOTAL</td>
  <td style="text-align:right">${fmt(totalCents)}</td>
</tr></table>
<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">
<p style="font-size:10px;text-align:center">Escaneie o código para importar no PDV</p>
<p style="font-size:10px;text-align:center;font-weight:bold">${publicId}</p>
<svg id="barcode"></svg>
<script>
  JsBarcode("#barcode","${publicId}",{format:"CODE128",width:1.5,height:40,fontSize:10,margin:4,displayValue:false});
  window.onload=function(){window.print()};
</script>
</body>
</html>`;
}
