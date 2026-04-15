import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrintStatus } from "@/features/admin/print/PrintContext";
import { fetchPrintJobs, markPrintedById, reprintOrder } from "@/features/admin/print/api";
import type { PrintJobDto } from "@/features/admin/print/types";
import { Printer, CheckCircle2, Clock, RefreshCw, ExternalLink, Smartphone } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function JobRow({ job, onMarkPrinted, onReprint, loadingId }: {
  job: PrintJobDto;
  onMarkPrinted: (id: string) => void;
  onReprint: (orderId: string) => void;
  loadingId: string | null;
}) {
  const navigate = useNavigate();
  const busy = loadingId === job.id || loadingId === job.orderId;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-4 transition-colors"
      style={{
        backgroundColor: job.isPrinted ? "var(--surface)" : "rgba(239,68,68,0.05)",
        borderColor: job.isPrinted ? "var(--border)" : "rgba(239,68,68,0.3)",
      }}
    >
      <div className="shrink-0">
        {job.isPrinted
          ? <CheckCircle2 size={22} className="text-emerald-400" />
          : <Clock size={22} className="text-red-400 animate-pulse" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
            {job.publicId}
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: job.isPrinted ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: job.isPrinted ? "#10b981" : "#f87171",
            }}
          >
            {job.isPrinted ? "Impresso" : "Pendente"}
          </span>
        </div>
        <div className="text-xs mt-1 space-y-0.5" style={{ color: "var(--text-muted)" }}>
          <div>Criado: {fmtDate(job.createdAtUtc)}</div>
          {job.isPrinted && job.printedAtUtc && (
            <div>Impresso: {fmtDate(job.printedAtUtc)}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate(`/app/pedidos/${job.orderId}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
          title="Ver pedido"
        >
          <ExternalLink size={13} />
          <span className="hidden sm:inline">Pedido</span>
        </button>

        {!job.isPrinted && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMarkPrinted(job.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981" }}
            title="Marcar como impresso manualmente"
          >
            <CheckCircle2 size={13} />
            <span className="hidden sm:inline">Marcar impresso</span>
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => onReprint(job.orderId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: "rgba(124,92,248,0.12)", color: "#a78bfa" }}
          title="Reimprimir"
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Reimprimir</span>
        </button>
      </div>
    </div>
  );
}

export default function PrintQueue() {
  const { connected, printStation, togglePrintStation } = usePrintStatus();
  const qc = useQueryClient();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: () => fetchPrintJobs(60),
    refetchInterval: 10_000,
  });

  const markMut = useMutation({
    mutationFn: (jobId: string) => { setLoadingId(jobId); return markPrintedById(jobId); },
    onSettled: () => { setLoadingId(null); qc.invalidateQueries({ queryKey: ["print-jobs"] }); },
  });

  const reprintMut = useMutation({
    mutationFn: (orderId: string) => { setLoadingId(orderId); return reprintOrder(orderId); },
    onSettled: () => { setLoadingId(null); qc.invalidateQueries({ queryKey: ["print-jobs"] }); },
  });

  const pending = jobs.filter((j) => !j.isPrinted);
  const printed = jobs.filter((j) => j.isPrinted);

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* ── Estação de Impressão toggle ──────────────────────────────── */}
        <div
          className="rounded-2xl border p-5 mb-6"
          style={{
            backgroundColor: printStation ? "rgba(16,185,129,0.07)" : "var(--surface)",
            borderColor: printStation ? "rgba(16,185,129,0.35)" : "var(--border)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: printStation ? "rgba(16,185,129,0.15)" : "var(--surface-2)",
                }}
              >
                <Printer size={20} style={{ color: printStation ? "#10b981" : "var(--text-muted)" }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                  Este PC é a estação de impressão
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {printStation
                    ? "Pedidos novos serão impressos automaticamente neste PC"
                    : "Este PC não imprime — apenas visualiza a fila"}
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              onClick={togglePrintStation}
              className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
              style={{ backgroundColor: printStation ? "#10b981" : "var(--surface-2)" }}
              title={printStation ? "Desativar impressão neste PC" : "Ativar impressão neste PC"}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: printStation ? "translateX(24px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {/* Status da conexão */}
          {printStation && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: "rgba(16,185,129,0.2)" }}>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: connected ? "#10b981" : "#f87171",
                  boxShadow: connected ? "0 0 6px #10b981" : "none",
                }}
              />
              <span className="text-xs" style={{ color: connected ? "#10b981" : "#f87171" }}>
                {connected ? "Conectado ao servidor — pronto para imprimir" : "Desconectado — reconectando…"}
              </span>
            </div>
          )}
        </div>

        {/* ── Card Agente Mobile ───────────────────────────────────────── */}
        <Link
          to="/app/impressao/mobile"
          className="flex items-center gap-4 rounded-2xl border p-5 mb-6 transition-colors hover:border-brand/50 hover:bg-brand/5 group"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(124,92,248,0.10)" }}
          >
            <Smartphone size={20} style={{ color: "var(--brand)" }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Agente de Impressão Mobile
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Configure um tablet (Android ou iPad) para imprimir automaticamente via Bluetooth ou AirPrint
            </p>
          </div>
          <ExternalLink size={14} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: "var(--brand)" }} />
        </Link>

        {/* ── Header da fila ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>Fila de Impressão</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Últimos 60 jobs • atualiza a cada 10s</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
            title="Atualizar agora"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {isLoading && (
          <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
            Carregando fila…
          </p>
        )}

        {/* Pendentes */}
        {pending.length > 0 && (
          <section className="mb-6">
            <div className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#f87171" }}>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Pendentes ({pending.length})
            </div>
            <div className="space-y-2">
              {pending.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onMarkPrinted={(id) => markMut.mutate(id)}
                  onReprint={(oid) => reprintMut.mutate(oid)}
                  loadingId={loadingId}
                />
              ))}
            </div>
          </section>
        )}

        {pending.length === 0 && !isLoading && (
          <div
            className="rounded-2xl border p-8 text-center mb-6"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Fila vazia</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Nenhum job pendente</p>
          </div>
        )}

        {/* Impressos */}
        {printed.length > 0 && (
          <section>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Impressos recentes ({printed.length})
            </div>
            <div className="space-y-2">
              {printed.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onMarkPrinted={(id) => markMut.mutate(id)}
                  onReprint={(oid) => reprintMut.mutate(oid)}
                  loadingId={loadingId}
                />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
