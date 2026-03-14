import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLoyaltyConfig, updateLoyaltyConfig, type LoyaltyConfigDto } from "@/features/customers/customersApi";
import { Star, Save } from "lucide-react";

const INPUT = "rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" };

export default function LoyaltyConfigPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Omit<LoyaltyConfigDto, "updatedAtUtc">>({
    isEnabled: true,
    pointsPerReal: 1,
    pointsPerReais: 100,
    minRedemptionPoints: 500,
    maxDiscountPercent: 50,
  });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-config"],
    queryFn: getLoyaltyConfig,
  });

  useEffect(() => {
    if (data) {
      setForm({
        isEnabled:           data.isEnabled,
        pointsPerReal:       data.pointsPerReal,
        pointsPerReais:      data.pointsPerReais,
        minRedemptionPoints: data.minRedemptionPoints,
        maxDiscountPercent:  data.maxDiscountPercent,
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

  // Simulate example
  const exampleSpend = 150_00; // R$150
  const earnedPts = Math.floor(exampleSpend / 100 * form.pointsPerReal);
  const redemptionValueCents = form.pointsPerReais > 0
    ? Math.floor(earnedPts / form.pointsPerReais) * 100
    : 0;

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
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Configure o acúmulo e resgate de pontos</p>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>Carregando...</div>
        ) : (
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

            {/* Config fields */}
            <div className={`space-y-4 transition-opacity ${form.isEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Pontos por R$1,00 gasto
                  </label>
                  <input
                    type="number" step="0.1" min="0.1"
                    className={`mt-1 ${INPUT}`}
                    style={inputStyle}
                    value={form.pointsPerReal}
                    onChange={e => setForm(f => ({ ...f, pointsPerReal: parseFloat(e.target.value) || 1 }))}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Ex: 1 = 1 ponto por real</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Pontos para resgatar R$1,00
                  </label>
                  <input
                    type="number" min="1"
                    className={`mt-1 ${INPUT}`}
                    style={inputStyle}
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
                  <input
                    type="number" min="0"
                    className={`mt-1 ${INPUT}`}
                    style={inputStyle}
                    value={form.minRedemptionPoints}
                    onChange={e => setForm(f => ({ ...f, minRedemptionPoints: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Desconto máximo por venda (%)
                  </label>
                  <input
                    type="number" min="1" max="100"
                    className={`mt-1 ${INPUT}`}
                    style={inputStyle}
                    value={form.maxDiscountPercent}
                    onChange={e => setForm(f => ({ ...f, maxDiscountPercent: parseInt(e.target.value) || 50 }))}
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-amber-800 mb-2">Simulação — compra de R$150,00</p>
                <p className="text-amber-700">
                  Acúmulo: <strong>{earnedPts} pontos</strong>
                </p>
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

            {/* Save */}
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
        )}

      </div>
    </div>
  );
}
