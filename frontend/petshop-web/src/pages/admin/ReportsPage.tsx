import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  getSalesSummary, getSalesByDay, getTopProducts,
  getStockValuation, getFiscalSummary,
  fmtCurrency, fmtDate,
  type SalesSummary, type DayRevenue, type TopProduct,
  type StockValuation, type FiscalSummary,
} from "@/features/reports/reportApi";
import {
  BarChart2, ShoppingCart, TrendingUp, Package,
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
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-brand" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-sm text-gray-500">Analytics de vendas e estoque</p>
            </div>
          </div>

          {/* Date range selector */}
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    preset === p.value
                      ? "bg-brand text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                />
              </div>
            )}
          </div>
        </div>

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
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Receita por dia</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
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
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Top produtos</h2>
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sem dados no período.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-semibold text-gray-400 shrink-0 text-right">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate pr-2">
                          {p.name}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                          {fmtCurrency(p.totalCents)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand/70 rounded-full"
                          style={{ width: `${(p.totalCents / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
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
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Formas de pagamento</h2>
              {!summary?.byPaymentMethod?.length ? (
                <p className="text-sm text-gray-400 text-center py-4">Sem dados.</p>
              ) : (
                <div className="space-y-2.5">
                  {summary.byPaymentMethod.map(pm => {
                    const pct = summary.totalRevenueCents > 0
                      ? Math.round((pm.totalCents / summary.totalRevenueCents) * 100)
                      : 0;
                    return (
                      <div key={pm.method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">{methodLabel(pm.method)}</span>
                          <span className="text-gray-500 text-xs">{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${pct}%`, opacity: 0.6 + pct * 0.004 }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmtCurrency(pm.totalCents)} · {pm.count} transações
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fiscal summary */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-800">NFC-e no período</h2>
              </div>
              {!fiscal ? (
                <p className="text-sm text-gray-400 text-center py-2">Sem dados.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Autorizadas", value: fiscal.authorized, color: "text-green-600 bg-green-50" },
                    { label: "Rejeitadas",  value: fiscal.rejected,   color: "text-red-600 bg-red-50" },
                    { label: "Contingência",value: fiscal.contingency,color: "text-orange-600 bg-orange-50" },
                    { label: "Pendentes",   value: fiscal.pending,    color: "text-yellow-600 bg-yellow-50" },
                  ].map(item => (
                    <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                      <p className="text-xs font-medium opacity-80">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {totalFiscal > 0 && (
                <p className="text-xs text-gray-400 mt-3 text-center">
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
