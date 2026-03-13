import { useEffect, useState } from "react";
import { getCashRegisters, openSession, type CashRegister } from "@/features/pdv/api";
import { usePdv } from "@/features/pdv/PdvContext";

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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">Abrir Caixa</h1>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">Terminal</label>
          <select
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Selecione...</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">Fundo de caixa (R$)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
            value={(opening / 100).toFixed(2)}
            onChange={(e) => setOpening(Math.round(parseFloat(e.target.value || "0") * 100))}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          className="w-full py-3 rounded-xl font-semibold text-white text-sm transition active:scale-95"
          style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          disabled={submitting || !selected}
          onClick={handleOpen}
        >
          {submitting ? "Abrindo..." : "Abrir Caixa"}
        </button>

        {registers.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            Nenhum terminal ativo. Configure em Admin → Terminais.
          </p>
        )}
      </div>
    </div>
  );
}
