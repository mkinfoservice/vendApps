import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getAccountingDispatchConfig,
  saveAccountingDispatchConfig,
  testAccountingDispatchEmail,
  sendAccountingDispatchNow,
  listAccountingDispatchHistory,
  type AccountingDispatchConfigDto,
  type AccountingDispatchFrequency,
  type AccountingSendWhenNoMovement,
} from "@/features/accounting/accountingApi";
import { Loader2, Save, Send, TestTube, ShieldCheck } from "lucide-react";

const INPUT = "rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" };

const EMPTY: AccountingDispatchConfigDto = {
  isEnabled: false,
  accountantName: "",
  primaryEmail: "",
  ccEmails: "",
  frequency: "Monthly",
  dayOfMonth: 5,
  dayOfWeek: 1,
  sendTimeLocal: "09:00",
  timezoneId: "America/Sao_Paulo",
  includeXmlIssued: true,
  includeXmlCanceled: false,
  includeSalesCsv: true,
  includeSummaryPdf: true,
  maxRetryCount: 2,
  retryDelayMinutes: 15,
  fixedEmailNote: "",
  protectAttachments: false,
  attachmentPassword: null,
  maxAttachmentSizeMb: 15,
  sendWhenNoMovement: "Skip",
  lastSentAtUtc: null,
  lastSuccessAtUtc: null,
  updatedAtUtc: new Date().toISOString(),
};

function statusBadge(status: boolean) {
  return status
    ? "bg-green-100 text-green-700 border-green-300"
    : "bg-zinc-100 text-zinc-600 border-zinc-300";
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AccountingDispatchPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<AccountingDispatchConfigDto>(EMPTY);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["accounting-dispatch-config"],
    queryFn: getAccountingDispatchConfig,
  });

  const { data: history, isFetching: loadingHistory, refetch: reloadHistory } = useQuery({
    queryKey: ["accounting-dispatch-history"],
    queryFn: () => listAccountingDispatchHistory(1, 20),
  });

  useEffect(() => {
    if (cfg) setForm(cfg);
  }, [cfg]);

  const saveMut = useMutation({
    mutationFn: (payload: AccountingDispatchConfigDto) => saveAccountingDispatchConfig(payload),
    onSuccess: (data) => {
      setForm(data);
      setFeedback("Configuração salva.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["accounting-dispatch-config"] });
      qc.invalidateQueries({ queryKey: ["accounting-dispatch-history"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setFeedback(null);
    },
  });

  const testMut = useMutation({
    mutationFn: testAccountingDispatchEmail,
    onSuccess: (res) => {
      setFeedback(res.message);
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message);
      setFeedback(null);
    },
  });

  const sendNowMut = useMutation({
    mutationFn: () => {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodReference = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
      return sendAccountingDispatchNow({ periodReference, forceResend: false });
    },
    onSuccess: () => {
      setFeedback("Envio sob demanda executado. Confira o histórico.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["accounting-dispatch-history"] });
      qc.invalidateQueries({ queryKey: ["accounting-dispatch-config"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setFeedback(null);
    },
  });

  const canSave = useMemo(() => {
    return !!form.primaryEmail && !!form.sendTimeLocal && !!form.timezoneId;
  }, [form]);

  function set<K extends keyof AccountingDispatchConfigDto>(key: K, value: AccountingDispatchConfigDto[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 pt-6 space-y-6">
      <PageHeader
        title="Contabilidade Automatizada"
        subtitle="Fechamento contábil por tenant com envio automático ao contador"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending}
              className="h-9 px-3 rounded-xl text-sm font-medium border flex items-center gap-2"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
            >
              {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Testar envio
            </button>
            <button
              type="button"
              onClick={() => sendNowMut.mutate()}
              disabled={sendNowMut.isPending}
              className="h-9 px-3 rounded-xl text-sm font-semibold text-white bg-[#7c5cf8] flex items-center gap-2 hover:brightness-110 disabled:opacity-50"
            >
              {sendNowMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar agora
            </button>
          </div>
        }
      />

      <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Status do módulo</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Último envio: {fmtDate(form.lastSentAtUtc)} · Último sucesso: {fmtDate(form.lastSuccessAtUtc)}
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusBadge(form.isEnabled)}`}>
            {form.isEnabled ? "Automação habilitada" : "Automação desabilitada"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => set("isEnabled", e.target.checked)}
          />
          Habilitar envio automático de fechamento contábil
        </label>
      </section>

      <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Dados do contador</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={INPUT} style={inputStyle} placeholder="Nome do contador/escritório" value={form.accountantName ?? ""} onChange={(e) => set("accountantName", e.target.value)} />
          <input className={INPUT} style={inputStyle} placeholder="contador@empresa.com" value={form.primaryEmail ?? ""} onChange={(e) => set("primaryEmail", e.target.value)} />
          <input className={INPUT} style={inputStyle} placeholder="cc1@email.com; cc2@email.com" value={form.ccEmails ?? ""} onChange={(e) => set("ccEmails", e.target.value)} />
        </div>
      </section>

      <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Regras de envio</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select className={INPUT} style={inputStyle} value={form.frequency} onChange={(e) => set("frequency", e.target.value as AccountingDispatchFrequency)}>
            <option value="Monthly">Mensal</option>
            <option value="Weekly">Semanal</option>
            <option value="Daily">Diário</option>
            <option value="Manual">Manual</option>
          </select>
          <input className={INPUT} style={inputStyle} type="number" min={1} max={28} value={form.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value) || 1)} />
          <select className={INPUT} style={inputStyle} value={form.dayOfWeek} onChange={(e) => set("dayOfWeek", Number(e.target.value))}>
            <option value={0}>Domingo</option>
            <option value={1}>Segunda</option>
            <option value={2}>Terça</option>
            <option value={3}>Quarta</option>
            <option value={4}>Quinta</option>
            <option value={5}>Sexta</option>
            <option value={6}>Sábado</option>
          </select>
          <input className={INPUT} style={inputStyle} type="time" value={form.sendTimeLocal} onChange={(e) => set("sendTimeLocal", e.target.value)} />
          <input className={INPUT} style={inputStyle} placeholder="America/Sao_Paulo" value={form.timezoneId} onChange={(e) => set("timezoneId", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className={INPUT} style={inputStyle} type="number" min={0} max={5} value={form.maxRetryCount} onChange={(e) => set("maxRetryCount", Number(e.target.value) || 0)} />
          <input className={INPUT} style={inputStyle} type="number" min={1} max={120} value={form.retryDelayMinutes} onChange={(e) => set("retryDelayMinutes", Number(e.target.value) || 15)} />
          <input className={INPUT} style={inputStyle} type="number" min={5} max={30} value={form.maxAttachmentSizeMb} onChange={(e) => set("maxAttachmentSizeMb", Number(e.target.value) || 15)} />
          <select className={INPUT} style={inputStyle} value={form.sendWhenNoMovement} onChange={(e) => set("sendWhenNoMovement", e.target.value as AccountingSendWhenNoMovement)}>
            <option value="Skip">Sem movimento: pular</option>
            <option value="SendZeroed">Sem movimento: enviar zerado</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Conteúdo e segurança</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.includeXmlIssued} onChange={(e) => set("includeXmlIssued", e.target.checked)} /> XML emitidos</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.includeXmlCanceled} onChange={(e) => set("includeXmlCanceled", e.target.checked)} /> XML cancelados</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.includeSalesCsv} onChange={(e) => set("includeSalesCsv", e.target.checked)} /> CSV vendas</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.includeSummaryPdf} onChange={(e) => set("includeSummaryPdf", e.target.checked)} /> PDF resumo</label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.protectAttachments} onChange={(e) => set("protectAttachments", e.target.checked)} />
          Proteção adicional de anexos com senha
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
        </label>
        {form.protectAttachments && (
          <input className={INPUT} style={inputStyle} type="password" placeholder="Senha para anexos (opcional)" value={form.attachmentPassword ?? ""} onChange={(e) => set("attachmentPassword", e.target.value)} />
        )}
        <textarea
          className={`${INPUT} min-h-24`}
          style={inputStyle}
          placeholder="Observação fixa no corpo do e-mail (opcional)"
          value={form.fixedEmailNote ?? ""}
          onChange={(e) => set("fixedEmailNote", e.target.value)}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => saveMut.mutate(form)}
          disabled={saveMut.isPending || !canSave}
          className="h-10 px-4 rounded-xl bg-[#7c5cf8] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar configuração
        </button>
        {feedback && <p className="text-sm text-green-600 font-medium">{feedback}</p>}
        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      </div>

      <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Histórico de envios</h2>
          <button className="text-sm underline" onClick={() => reloadHistory()}>
            {loadingHistory ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-2">Período</th>
                <th className="py-2">Status</th>
                <th className="py-2">Vendas</th>
                <th className="py-2">XML</th>
                <th className="py-2">Líquido</th>
                <th className="py-2">Data</th>
                <th className="py-2">Erro</th>
              </tr>
            </thead>
            <tbody>
              {(history?.items ?? []).map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2">{r.periodReference}</td>
                  <td className="py-2">{r.status}</td>
                  <td className="py-2">{r.salesCount}</td>
                  <td className="py-2">{r.xmlCountIssued + r.xmlCountCanceled}</td>
                  <td className="py-2">{fmtMoney(r.netAmount)}</td>
                  <td className="py-2">{fmtDate(r.createdAtUtc)}</td>
                  <td className="py-2 max-w-[280px] truncate">{r.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(history?.items?.length ?? 0) === 0 && (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              Nenhum envio registrado ainda.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
