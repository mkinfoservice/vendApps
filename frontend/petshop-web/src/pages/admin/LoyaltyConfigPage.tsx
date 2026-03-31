import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLoyaltyConfig, updateLoyaltyConfig, getLoyaltyRanking, getLoyaltySummary,
  getCustomerLoyaltyDetail, adjustLoyaltyPoints,
  type LoyaltyConfigDto, type LoyaltyRankingItem, type CustomerLoyaltyDetail,
} from "@/features/customers/customersApi";
import {
  Star, Save, Trophy, TrendingUp, Users, Coins,
  ChevronRight, ArrowLeft, Plus, Minus, Loader2,
} from "lucide-react";

const INPUT = "rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" };

type Tab = "config" | "resumo" | "ranking";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ── Customer detail slide-in ──────────────────────────────────────────────────
function CustomerLoyaltyPanel({
  customerId,
  onBack,
}: {
  customerId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-customer", customerId],
    queryFn: () => getCustomerLoyaltyDetail(customerId),
  });

  const adjustMut = useMutation({
    mutationFn: () => adjustLoyaltyPoints(customerId, adjustPoints, adjustReason),
    onSuccess: (res) => {
      setAdjustMsg(res.message);
      setAdjustPoints(0);
      setAdjustReason("");
      qc.invalidateQueries({ queryKey: ["loyalty-customer", customerId] });
      qc.invalidateQueries({ queryKey: ["loyalty-ranking"] });
      qc.invalidateQueries({ queryKey: ["loyalty-summary"] });
      setTimeout(() => setAdjustMsg(null), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!data) return null;

  const d = data as CustomerLoyaltyDetail;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeft size={14} /> Voltar ao ranking
      </button>

      {/* Customer header */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>{d.customerName}</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{d.customerPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-500">{d.pointsBalance.toLocaleString("pt-BR")}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>pontos</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{fmtBRL(d.totalSpentCents)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>gasto total</p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{d.totalOrders}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>pedidos</p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
            <p className="text-sm font-bold text-green-600">{fmtBRL(d.discountValueCents)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>valor em desconto</p>
          </div>
        </div>
      </div>

      {/* Adjust points */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Ajustar pontos manualmente</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdjustPoints(p => p - 50)}
            className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-[--surface-2] transition"
            style={{ borderColor: "var(--border)" }}
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            value={adjustPoints}
            onChange={e => setAdjustPoints(parseInt(e.target.value) || 0)}
            className={`${INPUT} w-24 text-center`}
            style={inputStyle}
          />
          <button
            onClick={() => setAdjustPoints(p => p + 50)}
            className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-[--surface-2] transition"
            style={{ borderColor: "var(--border)" }}
          >
            <Plus size={14} />
          </button>
          <input
            placeholder="Motivo..."
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            className={`${INPUT} flex-1`}
            style={inputStyle}
          />
          <button
            disabled={adjustPoints === 0 || !adjustReason.trim() || adjustMut.isPending}
            onClick={() => adjustMut.mutate()}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 disabled:opacity-40 transition whitespace-nowrap"
          >
            {adjustMut.isPending ? "..." : "Aplicar"}
          </button>
        </div>
        {adjustMsg && <p className="text-sm text-green-600 font-medium">{adjustMsg}</p>}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Use valores negativos para remover pontos.</p>
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Histórico ({d.transactions.length})
          </h3>
        </div>
        {d.transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma transação ainda.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {d.transactions.map(t => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{t.description}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(t.createdAtUtc)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${t.points > 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.points > 0 ? "+" : ""}{t.points.toLocaleString("pt-BR")} pts
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>saldo: {t.balanceAfter.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ranking tab ───────────────────────────────────────────────────────────────
function RankingTab() {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const { data: ranking, isLoading } = useQuery({
    queryKey: ["loyalty-ranking"],
    queryFn: () => getLoyaltyRanking(30),
  });

  if (selectedCustomer) {
    return (
      <CustomerLoyaltyPanel
        customerId={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  const items = (ranking ?? []) as LoyaltyRankingItem[];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum cliente com pontos ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {items.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setSelectedCustomer(c.id)}
            className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[--surface-2] transition text-left"
          >
            {/* Position */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i === 0 ? "bg-amber-400 text-white" :
              i === 1 ? "bg-gray-300 text-gray-700" :
              i === 2 ? "bg-orange-300 text-white" :
              "bg-gray-100 text-gray-500"
            }`}>
              {i + 1}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{c.name}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {c.phone} · {c.totalOrders} pedidos · último: {fmtDate(c.lastOrderUtc)}
              </p>
            </div>

            {/* Points */}
            <div className="text-right shrink-0">
              <p className="text-base font-bold text-amber-500">{c.pointsBalance.toLocaleString("pt-BR")}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>pontos</p>
            </div>

            <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Resumo tab ────────────────────────────────────────────────────────────────
function ResumoTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-summary"],
    queryFn: getLoyaltySummary,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "Clientes com saldo", value: data.customersWithBalance.toLocaleString("pt-BR"), icon: Users, color: "#7c5cf8" },
    { label: "Pontos emitidos", value: data.totalPointsIssued.toLocaleString("pt-BR"), icon: TrendingUp, color: "#10b981" },
    { label: "Pontos resgatados", value: data.totalPointsRedeemed.toLocaleString("pt-BR"), icon: Coins, color: "#f59e0b" },
    { label: "Saldo em circulação", value: data.totalBalanceOutstanding.toLocaleString("pt-BR"), icon: Star, color: "#ef4444" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border p-5 flex items-center gap-4"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${c.color}20` }}>
              <c.icon className="w-5 h-5" style={{ color: c.color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{c.value}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Config tab (original) ─────────────────────────────────────────────────────
function ConfigTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Omit<LoyaltyConfigDto, "updatedAtUtc">>({
    isEnabled: true, pointsPerReal: 1, pointsPerReais: 100,
    minRedemptionPoints: 500, maxDiscountPercent: 50,
  });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-config"],
    queryFn: getLoyaltyConfig,
  });

  useEffect(() => {
    if (data) {
      setForm({
        isEnabled: data.isEnabled, pointsPerReal: data.pointsPerReal,
        pointsPerReais: data.pointsPerReais, minRedemptionPoints: data.minRedemptionPoints,
        maxDiscountPercent: data.maxDiscountPercent,
      });
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () => updateLoyaltyConfig(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const exampleSpend = 15000;
  const earnedPts = Math.floor(exampleSpend / 100 * form.pointsPerReal);
  const redemptionValueCents = form.pointsPerReais > 0
    ? Math.floor(earnedPts / form.pointsPerReais) * 100 : 0;

  if (isLoading) return (
    <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div className="rounded-2xl border p-6 space-y-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium" style={{ color: "var(--text)" }}>Ativar programa de pontos</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Clientes acumulam pontos a cada compra no PDV</p>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, isEnabled: !f.isEnabled }))}
          className={`relative w-12 h-6 rounded-full transition-colors ${form.isEnabled ? "bg-brand" : "bg-gray-200"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${form.isEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
      </div>

      <hr style={{ borderColor: "var(--border)" }} />

      <div className={`space-y-4 transition-opacity ${form.isEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Pontos por R$1,00 gasto
            </label>
            <input type="number" step="0.1" min="0.1"
              className={`mt-1 ${INPUT}`} style={inputStyle}
              value={form.pointsPerReal}
              onChange={e => setForm(f => ({ ...f, pointsPerReal: parseFloat(e.target.value) || 1 }))}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Ex: 1 = 1 ponto por real</p>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Pontos para resgatar R$1,00
            </label>
            <input type="number" min="1"
              className={`mt-1 ${INPUT}`} style={inputStyle}
              value={form.pointsPerReais}
              onChange={e => setForm(f => ({ ...f, pointsPerReais: parseInt(e.target.value) || 100 }))}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Ex: 100 = 100 pts = R$1</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Mínimo para resgate (pts)
            </label>
            <input type="number" min="0"
              className={`mt-1 ${INPUT}`} style={inputStyle}
              value={form.minRedemptionPoints}
              onChange={e => setForm(f => ({ ...f, minRedemptionPoints: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Desconto máximo por venda (%)
            </label>
            <input type="number" min="1" max="100"
              className={`mt-1 ${INPUT}`} style={inputStyle}
              value={form.maxDiscountPercent}
              onChange={e => setForm(f => ({ ...f, maxDiscountPercent: parseInt(e.target.value) || 50 }))}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-1">
          <p className="font-semibold text-amber-800 mb-2">Simulação — compra de R$150,00</p>
          <p className="text-amber-700">Acúmulo: <strong>{earnedPts} pontos</strong></p>
          <p className="text-amber-700">
            Valor de resgate: <strong>
              {(redemptionValueCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>
          </p>
          <p className="text-amber-600 text-xs mt-1">
            Saldo mínimo para resgatar: {form.minRedemptionPoints} pts
            {form.minRedemptionPoints > 0 && earnedPts < form.minRedemptionPoints
              ? ` (${form.minRedemptionPoints - earnedPts} pts restantes para atingir o mínimo)`
              : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && <span className="text-sm text-green-600 font-medium">Salvo!</span>}
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          {mut.isPending ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoyaltyConfigPage() {
  const [tab, setTab] = useState<Tab>("resumo");

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumo",  label: "Resumo" },
    { id: "ranking", label: "Ranking" },
    { id: "config",  label: "Configuração" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(245,158,11,0.15)" }}>
            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Programa de Fidelidade</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Pontos, ranking e configuração</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                tab === t.id
                  ? "bg-white shadow-sm text-brand"
                  : "hover:bg-white/50"
              }`}
              style={tab !== t.id ? { color: "var(--text-muted)" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "resumo"  && <ResumoTab />}
        {tab === "ranking" && <RankingTab />}
        {tab === "config"  && <ConfigTab />}

      </div>
    </div>
  );
}
