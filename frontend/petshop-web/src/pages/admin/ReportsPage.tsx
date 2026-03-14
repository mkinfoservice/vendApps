import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getSalesSummary, getSalesByDay, getTopProducts,
  getStockValuation, getFiscalSummary,
  fmtCurrency, fmtDate,
  type SalesSummary, type DayRevenue, type TopProduct,
  type StockValuation, type FiscalSummary,
} from "@/features/reports/reportApi";
import {
  ShoppingCart, TrendingUp, Package,
  FileText, Percent,
} from "lucide-react";

// ── Date range presets ────────────────────────────────────────────────────────

type Preset = "today" | "7d" | "30d" | "month" | "custom";

function getPresetRange(preset: Preset): [Date, Date] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return [today, today];
    case "7d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return [from, today];
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return [from, today];
    }
    case "month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return [from, today];
    }
    case "custom":
      return [today, today];
  }
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d",    label: "7 dias" },
  { value: "30d",   label: "30 dias" },
  { value: "month", label: "Este mês" },
  { value: "custom",label: "Personalizado" },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex items-start gap-4"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-brand" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-xl font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Payment method label map ──────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  DINHEIRO:        "Dinheiro",
  PIX:             "PIX",
  CARTAO_CREDITO:  "Crédito",
  CARTAO_DEBITO:   "Débito",
  CHEQUE:          "Cheque",
};

function methodLabel(m: string) {
  return METHOD_LABELS[m.toUpperCase()] ?? m;
}

// ── Tooltip custom ────────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-brand">{fmtCurrency(payload[0].value)}</p>
      <p className="text-gray-400">{payload[1]?.value} pedidos</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(fmtDate(new Date()));
  const [customTo, setCustomTo]     = useState(fmtDate(new Date()));

  const [from, to] = useMemo<[Date, Date]>(() => {
    if (preset === "custom") {
      return [new Date(customFrom + "T00:00:00"), new Date(customTo + "T00:00:00")];
    }
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const qKey = [fmtDate(from), fmtDate(to)];

  const { data: summary }   = useQuery<SalesSummary>({
    queryKey: ["report-summary", ...qKey],
    queryFn:  () => getSalesSummary(from, to),
  });

  const { data: byDay = [] } = useQuery<DayRevenue[]>({
    queryKey: ["report-by-day", ...qKey],
    queryFn:  () => getSalesByDay(from, to),
  });

  const { data: topProducts = [] } = useQuery<TopProduct[]>({
    queryKey: ["report-top", ...qKey],
    queryFn:  () => getTopProducts(from, to),
  });

  const { data: stock }  = useQuery<StockValuation>({
    queryKey: ["report-stock"],
    queryFn:  getStockValuation,
    staleTime: 60_000,
  });

  const { data: fiscal } = useQuery<FiscalSummary>({
    queryKey: ["report-fiscal", ...qKey],
    queryFn:  () => getFiscalSummary(from, to),
  });

  // Format chart data
  const chartData = byDay.map(d => ({
    date:    d.date.slice(5),   // "MM-DD"
    receita: d.revenueCents,
    pedidos: d.orderCount,
  }));

  const maxRevenue = Math.max(...(topProducts.map(p => p.totalCents)), 1);

  const totalFiscal = fiscal
    ? fiscal.authorized + fiscal.rejected + fiscal.contingency + fiscal.pending
    : 0;

  const dateRangeActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex gap-1 rounded-xl border p-1"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPreset(p.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={
              preset === p.value
                ? { backgroundColor: "var(--brand)", color: "#fff" }
                : { color: "var(--text-muted)" }
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          />
          <span style={{ color: "var(--text-muted)" }}>–</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 space-y-6">
        <PageHeader
          title="Relatórios"
          subtitle="Analytics de vendas e estoque"
          actions={dateRangeActions}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={TrendingUp}
            label="Receita total"
            value={summary ? fmtCurrency(summary.totalRevenueCents) : "—"}
            sub={summary ? `${summary.totalOrders} vendas` : undefined}
          />
          <KpiCard
            icon={ShoppingCart}
            label="Ticket médio"
            value={summary ? fmtCurrency(summary.avgTicketCents) : "—"}
          />
          <KpiCard
            icon={Percent}
            label="Descontos"
            value={summary ? fmtCurrency(summary.totalDiscountCents) : "—"}
          />
          <KpiCard
            icon={Package}
            label="Estoque (custo)"
            value={stock ? fmtCurrency(stock.totalValueCents) : "—"}
            sub={stock
              ? `${stock.outOfStockCount} zerados · ${stock.lowStockCount} baixos`
              : undefined}
          />
        </div>

        {/* Revenue chart */}
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Receita por dia</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
              Sem dados no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c5cf8" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7c5cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R$${(v / 100).toFixed(0)}`}
                  width={56}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="#7c5cf8"
                  strokeWidth={2}
                  fill="url(#colorReceita)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7c5cf8" }}
                />
                <Area
                  type="monotone"
                  dataKey="pedidos"
                  stroke="transparent"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Top products */}
          <div
            className="lg:col-span-2 rounded-2xl border p-5"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Top produtos</h2>
            {topProducts.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Sem dados no período.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-semibold shrink-0 text-right" style={{ color: "var(--text-muted)" }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-medium truncate pr-2" style={{ color: "var(--text)" }}>
                          {p.name}
                        </span>
                        <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text)" }}>
                          {fmtCurrency(p.totalCents)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                        <div
                          className="h-full bg-brand/70 rounded-full"
                          style={{ width: `${(p.totalCents / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {p.totalQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} un · {p.transactionCount} transações
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: payment + fiscal */}
          <div className="space-y-5">

            {/* Payment breakdown */}
            <div
              className="rounded-2xl border p-5"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Formas de pagamento</h2>
              {!summary?.byPaymentMethod?.length ? (
                <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>Sem dados.</p>
              ) : (
                <div className="space-y-2.5">
                  {summary.byPaymentMethod.map(pm => {
                    const pct = summary.totalRevenueCents > 0
                      ? Math.round((pm.totalCents / summary.totalRevenueCents) * 100)
                      : 0;
                    return (
                      <div key={pm.method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span style={{ color: "var(--text)" }}>{methodLabel(pm.method)}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${pct}%`, opacity: 0.6 + pct * 0.004 }}
                          />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {fmtCurrency(pm.totalCents)} · {pm.count} transações
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fiscal summary */}
            <div
              className="rounded-2xl border p-5"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text)" }}>NFC-e no período</h2>
              </div>
              {!fiscal ? (
                <p className="text-sm text-center py-2" style={{ color: "var(--text-muted)" }}>Sem dados.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Autorizadas", value: fiscal.authorized, color: "text-green-500 bg-green-500/10" },
                    { label: "Rejeitadas",  value: fiscal.rejected,   color: "text-red-500 bg-red-500/10" },
                    { label: "Contingência",value: fiscal.contingency,color: "text-orange-500 bg-orange-500/10" },
                    { label: "Pendentes",   value: fiscal.pending,    color: "text-yellow-500 bg-yellow-500/10" },
                  ].map(item => (
                    <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                      <p className="text-xs font-medium opacity-80">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {totalFiscal > 0 && (
                <p className="text-xs mt-3 text-center" style={{ color: "var(--text-muted)" }}>
                  Total: {totalFiscal} documentos
                </p>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
