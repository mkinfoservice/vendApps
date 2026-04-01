import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCommissionAdjustment,
  addTipEntry,
  deleteTipEntry,
  fetchCommissionConfig,
  fetchCommissionEmployees,
  fetchCommissionSummary,
  fetchTips,
  resetEmployeeRate,
  setEmployeeRate,
  updateCommissionConfig,
  type EmployeeCommissionItem,
} from "@/features/commissions/commissionsApi";
import { CalendarRange, HandCoins, PiggyBank, Save, Trash2, Users } from "lucide-react";

const INPUT =
  "h-10 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#C8953A]/30";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function CommissionsPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [tipDate, setTipDate] = useState(todayISO());
  const [tipAmount, setTipAmount] = useState("");
  const [tipDesc, setTipDesc] = useState("");
  const [adjUser, setAdjUser] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDesc, setAdjDesc] = useState("");
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  const configQ = useQuery({ queryKey: ["commissions-config"], queryFn: fetchCommissionConfig });
  const employeesQ = useQuery({ queryKey: ["commissions-employees"], queryFn: fetchCommissionEmployees });
  const summaryQ = useQuery({
    queryKey: ["commissions-summary", from, to],
    queryFn: () => fetchCommissionSummary(from, to),
  });
  const tipsQ = useQuery({
    queryKey: ["commissions-tips", from, to],
    queryFn: () => fetchTips(from, to),
  });

  const saveConfigMut = useMutation({
    mutationFn: updateCommissionConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions-config"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
    },
  });

  const setRateMut = useMutation({
    mutationFn: ({ userId, percent }: { userId: string; percent: number }) =>
      setEmployeeRate(userId, percent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions-employees"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
    },
  });

  const resetRateMut = useMutation({
    mutationFn: resetEmployeeRate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions-employees"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
    },
  });

  const addTipMut = useMutation({
    mutationFn: addTipEntry,
    onSuccess: () => {
      setTipAmount("");
      setTipDesc("");
      qc.invalidateQueries({ queryKey: ["commissions-tips"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
    },
  });

  const deleteTipMut = useMutation({
    mutationFn: deleteTipEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions-tips"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
    },
  });

  const addAdjustmentMut = useMutation({
    mutationFn: addCommissionAdjustment,
    onSuccess: () => {
      setAdjAmount("");
      setAdjDesc("");
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
    },
  });

  const summary = summaryQ.data;
  const config = configQ.data;
  const employees = employeesQ.data ?? [];
  const tips = tipsQ.data ?? [];

  const totals = summary?.totals;
  const cards = useMemo(
    () =>
      totals
        ? [
            { label: "Vendas base", value: brl(totals.salesCents) },
            { label: "Comissões", value: brl(totals.commissionCents) },
            { label: "Gorjetas", value: brl(totals.tipsCents) },
            { label: "Total a pagar", value: brl(totals.payableCents) },
          ]
        : [],
    [totals],
  );

  return (
    <div className="mx-auto max-w-[1300px] p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(160,114,48,0.12)" }}>
            <HandCoins size={18} style={{ color: "#A07230" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Comissões e Gorjetas</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cálculo por período, taxas por colaborador e distribuição de gorjeta</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="date" className={INPUT} style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className={INPUT} style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: "var(--text)" }}>{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <CalendarRange size={16} style={{ color: "var(--text-muted)" }} />
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Configuração global</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              Comissão padrão (%)
              <input
                type="number"
                step="0.1"
                className={`mt-1 w-full ${INPUT}`}
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={config?.defaultCommissionPercent ?? 0}
                onChange={(e) =>
                  saveConfigMut.mutate({
                    defaultCommissionPercent: Number(e.target.value || 0),
                  })
                }
              />
            </label>

            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              Modo da gorjeta
              <select
                className={`mt-1 w-full ${INPUT}`}
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={config?.tipDistributionMode ?? "proportional_sales"}
                onChange={(e) => saveConfigMut.mutate({ tipDistributionMode: e.target.value })}
              >
                <option value="proportional_sales">Proporcional às vendas</option>
                <option value="proportional_commission">Proporcional à comissão</option>
                <option value="equal">Divisão igualitária</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              className="px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              onClick={() => saveConfigMut.mutate({ isEnabled: !(config?.isEnabled ?? true) })}
            >
              {config?.isEnabled ? "Comissão ativa" : "Comissão inativa"}
            </button>
            <button
              className="px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              onClick={() => saveConfigMut.mutate({ isTipEnabled: !(config?.isTipEnabled ?? true) })}
            >
              {config?.isTipEnabled ? "Gorjeta ativa" : "Gorjeta inativa"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {saveConfigMut.isPending ? "Salvando..." : "Alterações aplicadas em tempo real"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <PiggyBank size={16} style={{ color: "var(--text-muted)" }} />
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Lançar gorjeta</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
            <input type="date" className={INPUT} style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} value={tipDate} onChange={(e) => setTipDate(e.target.value)} />
            <input
              className={INPUT}
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
              placeholder="Descrição (opcional)"
              value={tipDesc}
              onChange={(e) => setTipDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              className={`${INPUT} flex-1`}
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
              placeholder="Valor em reais (ex.: 120,50)"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
            />
            <button
              className="px-4 h-10 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#A07230" }}
              onClick={() => {
                const cents = Math.round(Number(tipAmount.replace(",", ".")) * 100);
                if (!Number.isFinite(cents) || cents <= 0) return;
                addTipMut.mutate({ referenceDateUtc: tipDate, amountCents: cents, description: tipDesc });
              }}
            >
              Adicionar
            </button>
          </div>

          <div className="max-h-48 overflow-auto divide-y" style={{ borderColor: "var(--border)" }}>
            {tips.map((t) => (
              <div key={t.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{t.description || "Gorjeta"}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(t.referenceDateUtc).toLocaleDateString("pt-BR")} • {t.createdBy}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{brl(t.amountCents)}</span>
                  <button className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }} onClick={() => deleteTipMut.mutate(t.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {tips.length === 0 && (
              <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>Nenhuma gorjeta lançada no período.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: "var(--text-muted)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text)" }}>Taxa por colaborador</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {employees.map((e: EmployeeCommissionItem) => {
            const val = rateInputs[e.userId] ?? String(e.commissionPercent);
            return (
              <div key={e.userId} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{e.username}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{e.role}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(160,114,48,0.12)", color: "#A07230" }}>
                    {e.hasCustomRate ? "custom" : "padrão"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className={`${INPUT} h-9`}
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                    value={val}
                    onChange={(ev) => setRateInputs((p) => ({ ...p, [e.userId]: ev.target.value }))}
                  />
                  <button
                    className="h-9 px-3 rounded-lg text-white text-sm"
                    style={{ backgroundColor: "#A07230" }}
                    onClick={() => setRateMut.mutate({ userId: e.userId, percent: Number(val.replace(",", ".")) || 0 })}
                  >
                    <Save size={14} />
                  </button>
                  {e.hasCustomRate && (
                    <button
                      className="h-9 px-2 rounded-lg border text-sm"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      onClick={() => resetRateMut.mutate(e.userId)}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <h2 className="font-semibold" style={{ color: "var(--text)" }}>Ajuste manual de comissão</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-2">
          <select
            className={INPUT}
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            value={adjUser}
            onChange={(e) => setAdjUser(e.target.value)}
          >
            <option value="">Selecione o colaborador</option>
            {employees.map((e) => (
              <option key={e.userId} value={e.userId}>{e.username}</option>
            ))}
          </select>
          <input
            className={INPUT}
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            placeholder="Valor (R$)"
            value={adjAmount}
            onChange={(e) => setAdjAmount(e.target.value)}
          />
          <input
            className={INPUT}
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            placeholder="Descrição"
            value={adjDesc}
            onChange={(e) => setAdjDesc(e.target.value)}
          />
          <button
            className="h-10 px-4 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: "#A07230" }}
            onClick={() => {
              const cents = Math.round(Number(adjAmount.replace(",", ".")) * 100);
              if (!adjUser || !Number.isFinite(cents) || cents === 0) return;
              addAdjustmentMut.mutate({ userId: adjUser, amountCents: cents, description: adjDesc });
            }}
          >
            Aplicar
          </button>
        </div>
      </section>

      <section className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold" style={{ color: "var(--text)" }}>Resumo por colaborador</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>
                {["Colaborador", "%", "Vendas", "Comissão", "Gorjeta", "Ajustes", "Total"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary?.employees.map((r) => (
                <tr key={r.userId} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{r.username}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{r.commissionPercent.toFixed(2)}%</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{brl(r.salesCents)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{brl(r.commissionCents)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{brl(r.tipsCents)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{brl(r.adjustmentsCents)}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "#A07230" }}>{brl(r.totalPayableCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!summaryQ.isLoading && (summary?.employees.length ?? 0) === 0 && (
            <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Sem dados no período selecionado.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
