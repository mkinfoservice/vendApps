import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listAdminSessions, getSessionReport, getCashRegisters,
  type AdminSession, type SessionReport, type CashRegister,
} from "@/features/pdv/api";
import { Loader2, X } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function duration(start: string, end: string | null) {
  if (!end) return "—";
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

const payLabel: Record<string, string> = {
  PIX: "PIX", DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Crédito", CARTAO_DEBITO: "Débito", CHEQUE: "Cheque",
};

// ── Session Report Modal ──────────────────────────────────────────────────────

function SessionReportModal({ session, onClose }: { session: AdminSession; onClose: () => void }) {
  const { data: report, isLoading } = useQuery<SessionReport>({
    queryKey: ["session-report", session.id],
    queryFn: () => getSessionReport(session.id) as Promise<SessionReport>,
  });

  const divergence = (report?.closingBalanceCents ?? null) !== null
    ? (report!.closingBalanceCents! - report!.expectedCashCents)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="font-bold text-gray-800">{session.registerName}</p>
            <p className="text-xs text-gray-400">
              {fmtDateTime(session.openedAtUtc)}
              {session.closedAtUtc && ` → ${fmtDateTime(session.closedAtUtc)}`}
              {" · "}{duration(session.openedAtUtc, session.closedAtUtc)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} /></div>
        ) : report && (
          <div className="p-6 space-y-5">
            {/* Operators */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Abertura</p>
                <p className="font-medium text-gray-700">{report.openedByUserName}</p>
              </div>
              {report.closedByUserName && (
                <div>
                  <p className="text-xs text-gray-400">Fechamento</p>
                  <p className="font-medium text-gray-700">{report.closedByUserName}</p>
                </div>
              )}
            </div>

            {/* Sales summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Vendas</p>
              <div className="flex justify-between text-sm font-semibold">
                <span>{report.totalSalesCount} venda(s)</span>
                <span>{brl(report.totalSalesCents)}</span>
              </div>
              {report.byPaymentMethod.map((b) => (
                <div key={b.paymentMethod} className="flex justify-between text-sm text-gray-500">
                  <span>{payLabel[b.paymentMethod] ?? b.paymentMethod}</span>
                  <span>{brl(b.totalCents)}</span>
                </div>
              ))}
              {report.cancelledSalesCount > 0 && (
                <p className="text-xs text-red-400">{report.cancelledSalesCount} cancelada(s)</p>
              )}
              {report.permanentContingencyCount > 0 && (
                <p className="text-xs text-orange-400">{report.permanentContingencyCount} em contingência permanente</p>
              )}
            </div>

            {/* Movements */}
            {(report.movements.length > 0) && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Movimentos</p>
                {report.movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className={`font-medium ${m.type === "Sangria" ? "text-red-600" : "text-green-700"}`}>
                        {m.type}
                      </span>
                      {m.description && <span className="text-gray-400 text-xs ml-2">— {m.description}</span>}
                    </div>
                    <span className={`font-semibold ${m.type === "Sangria" ? "text-red-600" : "text-green-700"}`}>
                      {m.type === "Sangria" ? "-" : "+"}{brl(m.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Cash balance */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Conferência de Caixa</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fundo inicial</span>
                <span>{brl(report.openingBalanceCents)}</span>
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Saldo esperado</span>
                <span className="font-semibold">{brl(report.expectedCashCents)}</span>
              </div>
              {report.closingBalanceCents !== null && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Contagem física</span>
                    <span>{brl(report.closingBalanceCents)}</span>
                  </div>
                  {divergence !== null && (
                    <div className={`flex justify-between text-sm font-semibold rounded-lg px-3 py-1 ${
                      divergence === 0 ? "bg-green-50 text-green-700"
                      : divergence > 0 ? "bg-yellow-50 text-yellow-700"
                      : "bg-red-50 text-red-700"
                    }`}>
                      <span>Divergência</span>
                      <span>{divergence > 0 ? "+" : ""}{brl(divergence)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashSessionsPage() {
  const [registerId, setRegisterId] = useState("");
  const [status, setStatus]         = useState("");
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState<AdminSession | null>(null);

  const { data: registers = [] } = useQuery<CashRegister[]>({
    queryKey: ["cash-registers"],
    queryFn: getCashRegisters,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sessions", registerId, status, page],
    queryFn: () => listAdminSessions({ registerId: registerId || undefined, status: status || undefined, page }),
  });

  const sessions  = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--text)" }}>Histórico de Sessões</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <select
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
            value={registerId}
            onChange={(e) => { setRegisterId(e.target.value); setPage(1); }}
          >
            <option value="">Todos os terminais</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <select
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">Todos os status</option>
            <option value="Open">Aberta</option>
            <option value="Closed">Fechada</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} /></div>
        ) : (
          <>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <table className="w-full text-sm">
                <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    <th className="px-5 py-3">Abertura</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Terminal</th>
                    <th className="px-4 py-3 hidden md:table-cell">Operador</th>
                    <th className="px-4 py-3">Vendas</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Total</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center" style={{ color: "var(--text-muted)" }}>Nenhuma sessão encontrada.</td></tr>
                  )}
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="border-t cursor-pointer transition"
                      style={{ borderColor: "var(--border)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)"}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ""}
                    >
                      <td className="px-5 py-3 text-xs" style={{ color: "var(--text)" }}>
                        {fmtDateTime(s.openedAtUtc)}
                        <span className="block" style={{ color: "var(--text-muted)" }}>{duration(s.openedAtUtc, s.closedAtUtc)}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell font-medium" style={{ color: "var(--text)" }}>{s.registerName}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "var(--text-muted)" }}>{s.openedByUserName}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>{s.totalSalesCount}</td>
                      <td className="px-4 py-3 hidden sm:table-cell font-semibold" style={{ color: "var(--text)" }}>{brl(s.totalSalesCents)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.status === "Open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {s.status === "Open" ? "Aberta" : "Fechada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40"
                  style={{ borderColor: "var(--border)" }}
                >
                  ‹ Anterior
                </button>
                <span className="px-3 py-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40"
                  style={{ borderColor: "var(--border)" }}
                >
                  Próxima ›
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {selected && (
        <SessionReportModal session={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
