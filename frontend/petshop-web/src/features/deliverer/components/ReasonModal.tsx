import { useState } from "react";
import { X } from "lucide-react";

const FAIL_REASONS = [
  "Cliente ausente",
  "Endereço não encontrado",
  "Área de risco",
  "Recusou receber",
];

const SKIP_REASONS = [
  "Passarei depois",
  "Cliente pediu para pular",
  "Problema com acesso",
  "Outro motivo",
];

type Props = {
  type: "fail" | "skip";
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ReasonModal({ type, onConfirm, onCancel, loading }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const isFail = type === "fail";
  const presets = isFail ? FAIL_REASONS : SKIP_REASONS;
  const title = isFail ? "Motivo da falha" : "Motivo para pular";
  const actionLabel = isFail ? "Confirmar Falha" : "Confirmar Pular";
  const actionStyle = isFail
    ? { backgroundColor: "#ef4444" }
    : { backgroundColor: "#f59e0b" };

  const reason = selected === "__custom" ? custom.trim() : (selected ?? "");

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-bold text-base" style={{ color: "var(--text)" }}>{title}</span>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {presets.map((r) => (
            <button
              key={r}
              onClick={() => { setSelected(r); setCustom(""); }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: selected === r ? "rgba(124,92,248,0.15)" : "var(--surface-2)",
                border: `1px solid ${selected === r ? "#7c5cf8" : "var(--border)"}`,
                color: selected === r ? "#9b7efa" : "var(--text)",
              }}
            >
              {r}
            </button>
          ))}

          {/* Custom option */}
          <button
            onClick={() => setSelected("__custom")}
            className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: selected === "__custom" ? "rgba(124,92,248,0.15)" : "var(--surface-2)",
              border: `1px solid ${selected === "__custom" ? "#7c5cf8" : "var(--border)"}`,
              color: selected === "__custom" ? "#9b7efa" : "var(--text-muted)",
            }}
          >
            Outro motivo...
          </button>

          {selected === "__custom" && (
            <textarea
              className="w-full h-20 rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#7c5cf8]/40"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              placeholder="Descreva o motivo..."
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason || loading}
            className="flex-1 h-11 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={actionStyle}
          >
            {loading ? "..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
