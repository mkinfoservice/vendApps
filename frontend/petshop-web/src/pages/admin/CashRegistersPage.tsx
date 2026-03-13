import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Loader2, Plus, Pencil } from "lucide-react";

// ── API ───────────────────────────────────────────────────────────────────────

export interface CashRegisterDto {
  id: string;
  name: string;
  fiscalSerie: string;
  fiscalAutoIssuePix: boolean;
  fiscalSendCashToSefaz: boolean;
  isActive: boolean;
}

function listRegisters(): Promise<CashRegisterDto[]> {
  return adminFetch<CashRegisterDto[]>("/admin/cash-registers");
}

function createRegister(body: Omit<CashRegisterDto, "id" | "isActive">): Promise<CashRegisterDto> {
  return adminFetch<CashRegisterDto>("/admin/cash-registers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function updateRegister(id: string, body: Partial<CashRegisterDto>): Promise<void> {
  return adminFetch(`/admin/cash-registers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  item: CashRegisterDto | null;
  onClose: () => void;
}

function RegisterModal({ item, onClose }: ModalProps) {
  const qc = useQueryClient();
  const [name, setName]       = useState(item?.name ?? "");
  const [serie, setSerie]     = useState(item?.fiscalSerie ?? "001");
  const [autoPix, setAutoPix] = useState(item?.fiscalAutoIssuePix ?? true);
  const [sendCash, setSendCash] = useState(item?.fiscalSendCashToSefaz ?? false);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [error, setError]     = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (item) {
        await updateRegister(item.id, { name, fiscalSerie: serie, fiscalAutoIssuePix: autoPix, fiscalSendCashToSefaz: sendCash, isActive });
      } else {
        await createRegister({ name, fiscalSerie: serie, fiscalAutoIssuePix: autoPix, fiscalSendCashToSefaz: sendCash });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cash-registers"] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  const ok = name.trim().length > 0 && serie.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">{item ? "Editar Terminal" : "Novo Terminal"}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Nome do terminal *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Caixa 1, PDV Balcão"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Série fiscal NFC-e</label>
            <input
              maxLength={3}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              value={serie} onChange={(e) => setSerie(e.target.value)}
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#7c5cf8]"
                checked={autoPix} onChange={(e) => setAutoPix(e.target.checked)} />
              <span className="text-sm text-gray-700">Emitir NFC-e automaticamente para PIX</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#7c5cf8]"
                checked={sendCash} onChange={(e) => setSendCash(e.target.checked)} />
              <span className="text-sm text-gray-700">Enviar dinheiro ao SEFAZ</span>
            </label>
            {item && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#7c5cf8]"
                  checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span className="text-sm text-gray-700">Terminal ativo</span>
              </label>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button
            disabled={!ok || mut.isPending}
            onClick={() => mut.mutate()}
            className="flex-1 py-2 text-sm font-semibold rounded-xl text-white bg-[#7c5cf8] hover:brightness-110 disabled:opacity-40 transition"
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashRegistersPage() {
  const [editing, setEditing] = useState<CashRegisterDto | null | undefined>(undefined);

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: listRegisters,
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Terminais PDV</h1>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
          >
            <Plus size={15} /> Novo Terminal
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <table className="w-full text-sm">
              <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                <tr className="text-left text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Série</th>
                  <th className="px-4 py-3 hidden md:table-cell">NFC-e PIX</th>
                  <th className="px-4 py-3 hidden md:table-cell">SEFAZ Dinheiro</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {registers.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Nenhum terminal cadastrado.</td></tr>
                )}
                {registers.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>{r.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs" style={{ color: "var(--text-muted)" }}>{r.fiscalSerie}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.fiscalAutoIssuePix ? "Sim" : "Não"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.fiscalSendCashToSefaz ? "Sim" : "Não"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(r)} className="text-gray-400 hover:text-gray-600 transition">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing !== undefined && (
        <RegisterModal item={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
