import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { getCashRegisters, openSession, type CashRegister } from "@/features/pdv/api";
import { usePdv } from "@/features/pdv/PdvContext";

const GC = { bg: "#FAF7F2", cream: "#F5EDE0", brown: "#6B4F3A", dark: "#1C1209", caramel: "#C8953A" };

interface Props {
  onOpened: () => void;
}

export default function OpenSessionPage({ onOpened }: Props) {
  const { refreshSession } = usePdv();
  const [registers, setRegisters]   = useState<CashRegister[]>([]);
  const [selected, setSelected]     = useState<string>("");
  const [opening, setOpening]       = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    getCashRegisters().then((rs) => {
      const active = rs.filter((r) => r.isActive);
      setRegisters(active);
      if (active.length === 1) setSelected(active[0].id);
    });
  }, []);

  async function handleOpen() {
    if (!selected) { setError("Selecione um terminal."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await openSession({ cashRegisterId: selected, openingBalanceCents: opening });
      await refreshSession();
      onOpened();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao abrir sessão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: GC.bg }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
            style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 8px 32px rgba(28,18,9,0.25)" }}>
            <Coffee size={28} style={{ color: GC.caramel }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: GC.dark }}>Abrir Caixa</h1>
            <p className="text-sm mt-0.5" style={{ color: GC.brown, opacity: 0.65 }}>Frente de Caixa · Go Coffee</p>
          </div>
        </div>

        <div className="rounded-3xl p-6 space-y-5 shadow-sm"
          style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: GC.brown, opacity: 0.7 }}>Terminal</label>
            <select
              className="w-full rounded-xl px-3 py-3 text-sm focus:outline-none appearance-none"
              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, color: GC.dark, background: GC.bg }}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Selecione...</option>
              {registers.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: GC.brown, opacity: 0.7 }}>Fundo de caixa (R$)</label>
            <input
              type="number" min={0} step={0.01}
              className="w-full rounded-xl px-3 py-3 text-sm focus:outline-none"
              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, color: GC.dark, background: GC.bg }}
              value={(opening / 100).toFixed(2)}
              onChange={(e) => setOpening(Math.round(parseFloat(e.target.value || "0") * 100))}
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            className="w-full py-4 rounded-2xl font-black text-white text-base transition active:scale-95 disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 18px rgba(28,18,9,0.3)" }}
            disabled={submitting || !selected}
            onClick={handleOpen}
          >
            {submitting ? "Abrindo..." : "Abrir Caixa"}
          </button>

          {registers.length === 0 && (
            <p className="text-center text-xs" style={{ color: GC.brown, opacity: 0.5 }}>
              Nenhum terminal ativo. Configure em Admin → Terminais.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
