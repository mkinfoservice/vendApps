import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getSalesSummary,
  getSalesByDay,
  getTopProducts,
  getStockValuation,
  getFiscalSummary,
  fmtCurrency,
  fmtDate,
  type SalesSummary,
  type DayRevenue,
  type TopProduct,
  type StockValuation,
  type FiscalSummary,
} from "@/features/reports/reportApi";
import { fetchCommissionSummary, type CommissionSummary } from "@/features/commissions/commissionsApi";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import {
  ShoppingCart,
  TrendingUp,
  Package,
  FileText,
  Percent,
  Trash2,
  Wallet,
  Receipt,
  Medal,
  Users,
} from "lucide-react";

type Preset = "today" | "7d" | "30d" | "month" | "custom";
type ReportSection = "overview" | "sales" | "financial" | "stock" | "commissions" | "fiscal" | "ranking";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Personalizado" },
];

const SECTIONS: { value: ReportSection; label: string }[] = [
  { value: "overview", label: "Visao geral" },
  { value: "sales", label: "Vendas" },
  { value: "financial", label: "Financeiro" },
  { value: "stock", label: "Estoque" },
  { value: "commissions", label: "Comissoes" },
  { value: "fiscal", label: "Fiscais" },
  { value: "ranking", label: "Ranking" },
];

const METHOD_LABELS: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_CREDITO: "Credito",
  CARTAO_DEBITO: "Debito",
  CHEQUE: "Cheque",
};

function methodLabel(m: string) {
  return METHOD_LABELS[m.toUpperCase()] ?? m;
}

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

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
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
        <p className="text-xs uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="text-xl font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

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

export default function ReportsPage() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>("30d");
  const [section, setSection] = useState<ReportSection>("overview");
  const [customFrom, setCustomFrom] = useState(fmtDate(new Date()));
  const [customTo, setCustomTo] = useState(fmtDate(new Date()));
  const [resetting, setResetting] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [rankingLimit, setRankingLimit] = useState(10);

  async function handleResetSales() {
    if (!confirm("Apagar TODAS as vendas do PDV e sessoes de caixa desta empresa?\n\nEsta acao nao pode ser desfeita.")) {
      return;
    }

    setResetting(true);

    try {
      await adminFetch("/pdv/sales/all", { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["report-summary"] });
      qc.invalidateQueries({ queryKey: ["report-by-day"] });
      qc.invalidateQueries({ queryKey: ["report-top"] });
      qc.invalidateQueries({ queryKey: ["report-fiscal"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
      alert("Dados zerados com sucesso.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao zerar dados.");
    } finally {
      setResetting(false);
    }
  }

  const [from, to] = useMemo<[Date, Date]>(() => {
    if (preset === "custom") {
      return [new Date(customFrom + "T00:00:00"), new Date(customTo + "T00:00:00")];
    }

    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const qKey = [fmtDate(from), fmtDate(to)];

  const { data: summary } = useQuery<SalesSummary>({
    queryKey: ["report-summary", ...qKey],
    queryFn: () => getSalesSummary(from, to),
  });

  const { data: byDay = [] } = useQuery<DayRevenue[]>({
    queryKey: ["report-by-day", ...qKey],
    queryFn: () => getSalesByDay(from, to),
  });

  const { data: topProducts = [] } = useQuery<TopProduct[]>({
    queryKey: ["report-top", ...qKey, rankingLimit],
    queryFn: () => getTopProducts(from, to, rankingLimit),
  });

  const { data: stock } = useQuery<StockValuation>({
    queryKey: ["report-stock"],
    queryFn: getStockValuation,
    staleTime: 60_000,
  });

  const { data: fiscal } = useQuery<FiscalSummary>({
    queryKey: ["report-fiscal", ...qKey],
    queryFn: () => getFiscalSummary(from, to),
  });

  const { data: commissionSummary } = useQuery<CommissionSummary>({
    queryKey: ["commissions-summary", ...qKey],
    queryFn: () => fetchCommissionSummary(fmtDate(from), fmtDate(to)),
  });

  const chartData = byDay.map((d) => ({
    date: d.date.slice(5),
    receita: d.revenueCents,
    pedidos: d.orderCount,
  }));

  const maxRevenue = Math.max(...topProducts.map((p) => p.totalCents), 1);

  const totalFiscal = fiscal ? fiscal.authorized + fiscal.rejected + fiscal.contingency + fiscal.pending : 0;

  const paymentMethods = summary?.byPaymentMethod ?? [];
  const filteredPayments =
    paymentFilter === "ALL"
      ? paymentMethods
      : paymentMethods.filter((p) => p.method.toUpperCase() === paymentFilter.toUpperCase());

  const totalPaymentsCents = filteredPayments.reduce((acc, item) => acc + item.totalCents, 0);
  const paymentCount = filteredPayments.reduce((acc, item) => acc + item.count, 0);

  const dateRangeActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex gap-1 rounded-xl border p-1"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {PRESETS.map((p) => (
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
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          />
          <span style={{ color: "var(--text-muted)" }}>-</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          />
        </div>
      )}
    </div>
  );

  const sectionActions = (
    <div className="flex flex-wrap items-center gap-2">
      {SECTIONS.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => setSection(s.value)}
          className="h-9 px-3 rounded-xl text-xs font-semibold border transition"
          style={
            section === s.value
              ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
              : { backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  const sharedKpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon={TrendingUp}
        label="Receita total"
        value={summary ? fmtCurrency(summary.totalRevenueCents) : "-"}
        sub={summary ? `${summary.totalOrders} vendas` : undefined}
      />
      <KpiCard icon={ShoppingCart} label="Ticket medio" value={summary ? fmtCurrency(summary.avgTicketCents) : "-"} />
      <KpiCard icon={Percent} label="Descontos" value={summary ? fmtCurrency(summary.totalDiscountCents) : "-"} />
      <KpiCard
        icon={Package}
        label="Estoque (custo)"
        value={stock ? fmtCurrency(stock.totalValueCents) : "-"}
        sub={stock ? `${stock.outOfStockCount} zerados · ${stock.lowStockCount} baixos` : undefined}
      />
    </div>
  );

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 space-y-6">
        <PageHeader
          title="Relatorios"
          subtitle="Hub analitico com visao financeira, vendas, estoque, comissoes e fiscal"
          actions={
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {dateRangeActions}
              <button
                type="button"
                onClick={handleResetSales}
                disabled={resetting}
                title="Zerar todas as vendas do PDV (apenas para testes)"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "transparent" }}
              >
                <Trash2 size={13} />
                {resetting ? "Zerando..." : "Zerar vendas"}
              </button>
            </div>
          }
        />

        {sectionActions}

        {(section === "overview" || section === "sales" || section === "financial" || section === "stock") && sharedKpis}

        {(section === "overview" || section === "sales") && (
          <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="font-semibold" style={{ color: "var(--text)" }}>
                Receita por dia
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Media diaria: {summary && byDay.length > 0 ? fmtCurrency(Math.round(summary.totalRevenueCents / byDay.length)) : "-"}
              </p>
            </div>

            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                Sem dados no periodo.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c5cf8" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#7c5cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                    width={56}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area type="monotone" dataKey="receita" stroke="#7c5cf8" strokeWidth={2} fill="url(#colorReceita)" dot={false} activeDot={{ r: 4, fill: "#7c5cf8" }} />
                  <Area type="monotone" dataKey="pedidos" stroke="transparent" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {(section === "overview" || section === "financial") && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="rounded-2xl border p-5 xl:col-span-2" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Wallet size={16} style={{ color: "var(--text-muted)" }} />
                  <h2 className="font-semibold" style={{ color: "var(--text)" }}>
                    Consolidado financeiro
                  </h2>
                </div>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border text-xs"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                >
                  <option value="ALL">Todos os metodos</option>
                  {paymentMethods.map((m) => (
                    <option key={m.method} value={m.method}>
                      {methodLabel(m.method)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <KpiCard icon={Wallet} label="Receita filtrada" value={fmtCurrency(totalPaymentsCents)} />
                <KpiCard icon={Receipt} label="Transacoes" value={paymentCount.toString()} />
                <KpiCard
                  icon={Percent}
                  label="Participacao"
                  value={summary && summary.totalRevenueCents > 0 ? `${Math.round((totalPaymentsCents / summary.totalRevenueCents) * 100)}%` : "0%"}
                />
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead style={{ backgroundColor: "var(--surface-2)" }}>
                    <tr>
                      {[
                        "Metodo",
                        "Valor",
                        "Qtd.",
                        "% Receita",
                      ].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-muted)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((pm) => {
                      const pct = summary && summary.totalRevenueCents > 0 ? Math.round((pm.totalCents / summary.totalRevenueCents) * 100) : 0;
                      return (
                        <tr key={pm.method} className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="px-3 py-2" style={{ color: "var(--text)" }}>{methodLabel(pm.method)}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text)" }}>{fmtCurrency(pm.totalCents)}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text)" }}>{pm.count}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text)" }}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredPayments.length === 0 && (
                  <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    Sem metodos no filtro selecionado.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Indicadores</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span style={{ color: "var(--text-muted)" }}>Periodo</span><strong style={{ color: "var(--text)" }}>{fmtDate(from)} a {fmtDate(to)}</strong></div>
                <div className="flex items-center justify-between"><span style={{ color: "var(--text-muted)" }}>Receita bruta</span><strong style={{ color: "var(--text)" }}>{summary ? fmtCurrency(summary.totalRevenueCents) : "-"}</strong></div>
                <div className="flex items-center justify-between"><span style={{ color: "var(--text-muted)" }}>Descontos</span><strong style={{ color: "var(--text)" }}>{summary ? fmtCurrency(summary.totalDiscountCents) : "-"}</strong></div>
                <div className="flex items-center justify-between"><span style={{ color: "var(--text-muted)" }}>Ticket medio</span><strong style={{ color: "var(--text)" }}>{summary ? fmtCurrency(summary.avgTicketCents) : "-"}</strong></div>
              </div>
            </div>
          </div>
        )}

        {(section === "overview" || section === "stock") && (
          <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Estoque detalhado</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard icon={Package} label="Produtos cadastrados" value={stock ? stock.totalProducts.toString() : "-"} />
              <KpiCard icon={Package} label="Sem estoque" value={stock ? stock.outOfStockCount.toString() : "-"} />
              <KpiCard icon={Package} label="Estoque baixo" value={stock ? stock.lowStockCount.toString() : "-"} />
            </div>
          </div>
        )}

        {(section === "overview" || section === "commissions") && (
          <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: "var(--text-muted)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text)" }}>Comissoes no periodo</h2>
              </div>
              <a
                href="/app/comissoes"
                className="h-9 px-3 rounded-xl text-xs font-semibold border inline-flex items-center"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                Abrir modulo de comissoes
              </a>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={Wallet} label="Vendas base" value={commissionSummary ? fmtCurrency(commissionSummary.totals.salesCents) : "-"} />
              <KpiCard icon={Users} label="Comissao" value={commissionSummary ? fmtCurrency(commissionSummary.totals.commissionCents) : "-"} />
              <KpiCard icon={Users} label="Gorjetas" value={commissionSummary ? fmtCurrency(commissionSummary.totals.tipsCents) : "-"} />
              <KpiCard icon={Users} label="Ajustes" value={commissionSummary ? fmtCurrency(commissionSummary.totals.adjustmentsCents) : "-"} />
              <KpiCard icon={Users} label="Total a pagar" value={commissionSummary ? fmtCurrency(commissionSummary.totals.payableCents) : "-"} />
            </div>
          </div>
        )}

        {(section === "overview" || section === "fiscal") && (
          <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <h2 className="font-semibold" style={{ color: "var(--text)" }}>Documentos fiscais</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { label: "Autorizadas", value: fiscal?.authorized ?? 0, color: "text-green-500 bg-green-500/10" },
                { label: "Rejeitadas", value: fiscal?.rejected ?? 0, color: "text-red-500 bg-red-500/10" },
                { label: "Contingencia", value: fiscal?.contingency ?? 0, color: "text-orange-500 bg-orange-500/10" },
                { label: "Pendentes", value: fiscal?.pending ?? 0, color: "text-yellow-500 bg-yellow-500/10" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                  <p className="text-xs font-medium opacity-80">{item.label}</p>
                  <p className="text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            {totalFiscal > 0 && (
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                Taxa de autorizacao: {fiscal ? Math.round((fiscal.authorized / totalFiscal) * 100) : 0}% ({totalFiscal} documentos)
              </p>
            )}
          </div>
        )}

        {(section === "overview" || section === "ranking") && (
          <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Medal size={16} style={{ color: "var(--text-muted)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text)" }}>Ranking de produtos</h2>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Top</span>
                <input
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={rankingLimit}
                  onChange={(e) => setRankingLimit(Number(e.target.value))}
                />
                <strong style={{ color: "var(--text)" }}>{rankingLimit}</strong>
              </div>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                Sem dados no periodo.
              </p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const pct = summary && summary.totalRevenueCents > 0 ? Math.round((p.totalCents / summary.totalRevenueCents) * 100) : 0;
                  return (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className="w-6 text-xs font-semibold shrink-0 text-right" style={{ color: "var(--text-muted)" }}>
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
                          <div className="h-full bg-brand/70 rounded-full" style={{ width: `${(p.totalCents / maxRevenue) * 100}%` }} />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {p.totalQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} un · {p.transactionCount} transacoes · {pct}% da receita
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
