import { useState } from "react";

const PRESET_REASONS = [
  "Cliente ausente",
  "Endereco nao encontrado",
  "Area de risco",
  "Recusou receber",
];

type Props = {
  title: string;
  actionLabel: string;
  actionColor: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ReasonModal({
  title,
  actionLabel,
  actionColor,
  onConfirm,
  onCancel,
  loading,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const reason = selected === "__custom" ? custom.trim() : (selected ?? "");

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom">
        <div className="text-lg font-bold">{title}</div>

        <div className="space-y-2">
          {PRESET_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => {
                setSelected(r);
                setCustom("");
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
                selected === r
                  ? "border-white bg-zinc-800 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}

          <button
            onClick={() => setSelected("__custom")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
              selected === "__custom"
                ? "border-white bg-zinc-800 text-white"
                : "border-zinc-700 bg-zinc-900 text-zinc-300"
            }`}
          >
            Outro motivo...
          </button>

          {selected === "__custom" && (
            <textarea
              className="w-full h-20 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white resize-none"
              placeholder="Descreva o motivo..."
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason || loading}
            className={`flex-1 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${actionColor}`}
          >
            {loading ? "..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
