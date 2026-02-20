import { useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { useFinanceiro } from "@/features/admin/financeiro/queries";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type RawStat = { date: string; revenueCents: number; deliveries: number; failures: number };
type ChartPoint = { label: string; revenueCents: number; deliveries: number; failures: number };

/** Para período <= 30 dias: mostra cada dia (dd/MM).
 *  Para > 30 dias: agrupa por semana (semanas ISO). */
function buildChartData(stats: RawStat[], period: number): ChartPoint[] {
  if (period <= 30) {
    return stats.map((s) => ({
      label: s.date.slice(5).replace("-", "/"), // "MM/DD" → "dd/MM"
      revenueCents: s.revenueCents,
      deliveries: s.deliveries,
      failures: s.failures,
    }));
  }

  // Agrupa por semana (lunes como início)
  const weeks: Record<string, ChartPoint> = {};
  for (const s of stats) {
    const d = new Date(s.date + "T00:00:00Z");
    // Início da semana (segunda-feira)
    const day = d.getUTCDay(); // 0=Dom
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diff);
    const key = monday.toISOString().slice(5, 10).replace("-", "/"); // "MM/DD"
    if (!weeks[key]) weeks[key] = { label: `S ${key}`, revenueCents: 0, deliveries: 0, failures: 0 };
    weeks[key].revenueCents += s.revenueCents;
    weeks[key].deliveries  += s.deliveries;
    weeks[key].failures    += s.failures;
  }
  return Object.values(weeks);
}

// ── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: "purple" | "green" | "amber" | "red";
}) {
  const bg: Record<typeof color, string> = {
    purple: "bg-[#7c5cf8]/15 text-[#9b7efa]",
    green:  "bg-emerald-500/15 text-emerald-400",
    amber:  "bg-amber-500/15 text-amber-400",
    red:    "bg-red-500/15 text-red-400",
  };
  const val: Record<typeof color, string> = {
    purple: "text-[#9b7efa]",
    green:  "text-emerald-300",
    amber:  "text-amber-300",
    red:    "text-red-300",
  };

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${bg[color]}`}>
          {icon}
        </div>
        <span className="text-[11px] font-medium leading-tight text-right" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <div className={`text-3xl font-extrabold tabular-nums ${val[color]}`}>{value}</div>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-xl"
      style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <div className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: "var(--text-muted)" }}>{p.name}:</span>
          <span className="font-bold">
            {currency ? formatBRL(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Period Selector ────────────────────────────────────────────────────────

const PERIODS = [
  { label: "7d",  value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function Financeiro() {
  const [period, setPeriod] = useState(30);
  const { data, isLoading, isError } = useFinanceiro(period);

  const chartData = data ? buildChartData(data.dailyStats, period) : [];

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Financeiro</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Receita, entregas e comissões
            </p>
          </div>
          {/* Period buttons */}
          <div
            className="flex rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--border)" }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-4 h-9 text-sm font-medium transition-all"
                style={{
                  backgroundColor: period === p.value ? "#7c5cf8" : "var(--surface)",
                  color: period === p.value ? "#fff" : "var(--text-muted)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-6">
            Erro ao carregar dados financeiros.
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="py-10 text-sm" style={{ color: "var(--text-muted)" }}>Carregando dados...</div>
        )}

        {data && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <MetricCard
                icon="💰"
                label="Receita total"
                value={formatBRL(data.totalRevenueCents)}
                color="purple"
              />
              <MetricCard
                icon="✅"
                label="Entregas concluídas"
                value={String(data.totalDeliveries)}
                color="green"
              />
              <MetricCard
                icon="📦"
                label="Ticket médio"
                value={formatBRL(data.avgPerDeliveryCents)}
                color="amber"
              />
              <MetricCard
                icon="❌"
                label="Falhas"
                value={String(data.totalFailures)}
                color="red"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Revenue line chart */}
              <div
                className="rounded-2xl border p-5"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
                  Receita diária
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                      width={52}
                    />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Line
                      type="monotone"
                      dataKey="revenueCents"
                      name="Receita"
                      stroke="#7c5cf8"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#7c5cf8" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Deliveries bar chart */}
              <div
                className="rounded-2xl border p-5"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
                  Entregas e falhas por dia
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="deliveries" name="Entregas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failures"   name="Falhas"   fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Commission table */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="px-5 py-4 border-b text-sm font-semibold"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                Comissões por entregador
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Entregador</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Entregas</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Por entrega</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Comissão total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.delivererCommissions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                        Nenhuma entrega no período.
                      </td>
                    </tr>
                  )}
                  {data.delivererCommissions.map((c, i) => (
                    <tr
                      key={c.delivererName}
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>
                        {c.delivererName}
                      </td>
                      <td className="px-5 py-3 text-center hidden sm:table-cell font-semibold" style={{ color: "var(--text)" }}>
                        {c.totalDeliveries}
                      </td>
                      <td className="px-5 py-3 text-center hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                        {formatBRL(c.perDeliveryCents)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-400">
                        {formatBRL(c.commissionCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
