import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getFiscalConfig, saveFiscalConfig, getSefazStatus,
  getFiscalDocuments,
  type FiscalConfigDto, type FiscalDocumentListItem,
} from "@/features/fiscal/fiscalApi";
import { Save, RefreshCw, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Upload } from "lucide-react";

// ── Masks ─────────────────────────────────────────────────────────────────────

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function unmask(v: string) {
  return v.replace(/\D/g, "");
}

// ── Styles ────────────────────────────────────────────────────────────────────

const EMPTY_CONFIG: FiscalConfigDto = {
  cnpj: "", inscricaoEstadual: "", uf: "", razaoSocial: "",
  nomeFantasia: null, logradouro: "", numeroEndereco: "",
  complemento: null, bairro: "", codigoMunicipio: 0,
  nomeMunicipio: "", cep: "", telefone: null,
  taxRegime: "SimplesNacional", sefazEnvironment: "Homologacao",
  certificateBase64: null, certificatePassword: null, certificatePath: null,
  cscId: null, cscToken: null, nfceSerie: 1, defaultCfop: "5102",
};

const STATUS_COLORS: Record<string, string> = {
  Authorized: "bg-green-900/30 text-green-400",
  Pending:    "bg-yellow-900/30 text-yellow-400",
  Rejected:   "bg-red-900/30 text-red-400",
  Contingency:"bg-orange-900/30 text-orange-400",
  Cancelled:  "bg-gray-900/30 text-gray-400",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS = [
  "rounded-lg px-3 py-2 text-sm w-full border outline-none",
  "transition-all focus:ring-2 focus:ring-[#7c5cf8]/30",
].join(" ");

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={INPUT_CLS}
      style={{
        backgroundColor: "var(--surface-2)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    />
  );
}

function Sel(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={INPUT_CLS}
      style={{
        backgroundColor: "var(--surface-2)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FiscalConfigPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<FiscalConfigDto>(EMPTY_CONFIG);
  const [showDocs, setShowDocs] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState<string | null>(null);

  // Masked display states
  const [cnpjDisplay, setCnpjDisplay]     = useState("");
  const [phoneDisplay, setPhoneDisplay]   = useState("");
  const [cepDisplay,   setCepDisplay]     = useState("");

  const certInputRef = useRef<HTMLInputElement>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["fiscal-config"],
    queryFn: getFiscalConfig,
  });

  const { data: sefazStatus, refetch: recheckSefaz, isFetching: checkingStatus } = useQuery({
    queryKey: ["sefaz-status"],
    queryFn: getSefazStatus,
    enabled: false,
  });

  const { data: documents = [] } = useQuery<FiscalDocumentListItem[]>({
    queryKey: ["fiscal-documents"],
    queryFn: () => getFiscalDocuments(1, 30),
    enabled: showDocs,
  });

  useEffect(() => {
    if (config) {
      setForm(config);
      setCnpjDisplay(maskCNPJ(config.cnpj ?? ""));
      setPhoneDisplay(maskPhone(config.telefone ?? ""));
      setCepDisplay(maskCEP(config.cep ?? ""));
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: saveFiscalConfig,
    onSuccess: (data) => {
      qc.setQueryData(["fiscal-config"], data);
      setSaved(true);
      setError(null);
      setTimeout(() => navigate("/app"), 1500);
    },
    onError: (e: Error) => setError(e.message),
  });

  function set(field: keyof FiscalConfigDto, value: string | number | null) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleCertFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]; // strip data:...;base64,
      set("certificateBase64", base64);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMut.mutate(form);
  }

  const section = "rounded-2xl border p-5 space-y-4";
  const sectionStyle = { backgroundColor: "var(--surface)", borderColor: "var(--border)" };

  if (isLoading) {
    return (
      <div style={{ backgroundColor: "var(--bg)" }}>
        <div className="max-w-4xl mx-auto p-6 animate-pulse space-y-4">
          <div className="h-8 rounded w-48" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="h-96 rounded-2xl" style={{ backgroundColor: "var(--surface-2)" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto px-4 pb-12 pt-6 space-y-6">

        <PageHeader
          title="Configuração Fiscal"
          subtitle="NFC-e · SEFAZ · Certificado Digital"
          actions={
            <button
              type="button"
              onClick={() => recheckSefaz()}
              disabled={checkingStatus}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? "animate-spin" : ""}`} />
              Status SEFAZ
            </button>
          }
        />

        {/* SEFAZ status */}
        {sefazStatus && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${sefazStatus.online ? "bg-green-900/20 border-green-800 text-green-400" : "bg-red-900/20 border-red-800 text-red-400"}`}
          >
            {sefazStatus.online ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            SEFAZ {sefazStatus.uf || "—"}: {sefazStatus.online ? "On-line" : "Off-line"}
            <span className="ml-auto text-xs opacity-70">
              Verificado {new Date(sefazStatus.checkedAtUtc).toLocaleTimeString("pt-BR")}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-800 rounded-xl text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-900/20 border border-green-800 rounded-xl text-sm text-green-400">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Configuração salva com sucesso.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Dados da empresa */}
          <section className={section} style={sectionStyle}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Dados da Empresa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CNPJ">
                <Inp
                  value={cnpjDisplay}
                  placeholder="00.000.000/0000-00"
                  onChange={e => {
                    const masked = maskCNPJ(e.target.value);
                    setCnpjDisplay(masked);
                    set("cnpj", unmask(masked));
                  }}
                />
              </Field>
              <Field label="Inscrição Estadual">
                <Inp value={form.inscricaoEstadual ?? ""} onChange={e => set("inscricaoEstadual", e.target.value)} />
              </Field>
              <Field label="Razão Social">
                <Inp value={form.razaoSocial ?? ""} maxLength={60} onChange={e => set("razaoSocial", e.target.value)} />
              </Field>
              <Field label="Nome Fantasia">
                <Inp value={form.nomeFantasia ?? ""} maxLength={60} onChange={e => set("nomeFantasia", e.target.value || null)} />
              </Field>
              <Field label="UF">
                <Inp
                  value={form.uf ?? ""} maxLength={2}
                  placeholder="SP"
                  onChange={e => set("uf", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Telefone">
                <Inp
                  value={phoneDisplay}
                  placeholder="(11) 99999-9999"
                  onChange={e => {
                    const masked = maskPhone(e.target.value);
                    setPhoneDisplay(masked);
                    set("telefone", unmask(masked) || null);
                  }}
                />
              </Field>
            </div>
          </section>

          {/* Endereço */}
          <section className={section} style={sectionStyle}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Endereço do Estabelecimento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Logradouro">
                <Inp value={form.logradouro ?? ""} maxLength={60} onChange={e => set("logradouro", e.target.value)} />
              </Field>
              <Field label="Número">
                <Inp value={form.numeroEndereco ?? ""} maxLength={60} onChange={e => set("numeroEndereco", e.target.value)} />
              </Field>
              <Field label="Complemento">
                <Inp value={form.complemento ?? ""} onChange={e => set("complemento", e.target.value || null)} />
              </Field>
              <Field label="Bairro">
                <Inp value={form.bairro ?? ""} maxLength={60} onChange={e => set("bairro", e.target.value)} />
              </Field>
              <Field label="Município">
                <Inp value={form.nomeMunicipio ?? ""} maxLength={60} onChange={e => set("nomeMunicipio", e.target.value)} />
              </Field>
              <Field label="Código IBGE do Município">
                <Inp
                  type="number"
                  value={form.codigoMunicipio}
                  placeholder="3550308"
                  onChange={e => set("codigoMunicipio", Number(e.target.value))}
                />
              </Field>
              <Field label="CEP">
                <Inp
                  value={cepDisplay}
                  placeholder="01310-100"
                  onChange={e => {
                    const masked = maskCEP(e.target.value);
                    setCepDisplay(masked);
                    set("cep", unmask(masked));
                  }}
                />
              </Field>
            </div>
          </section>

          {/* SEFAZ / Tributação */}
          <section className={section} style={sectionStyle}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>SEFAZ &amp; Tributação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Ambiente">
                <Sel value={form.sefazEnvironment ?? "Homologacao"} onChange={e => set("sefazEnvironment", e.target.value)}>
                  <option value="Homologacao">Homologação</option>
                  <option value="Producao">Produção</option>
                </Sel>
              </Field>
              <Field label="Regime Tributário">
                <Sel value={form.taxRegime ?? "SimplesNacional"} onChange={e => set("taxRegime", e.target.value)}>
                  <option value="SimplesNacional">Simples Nacional</option>
                  <option value="LucroPresumido">Lucro Presumido</option>
                  <option value="LucroReal">Lucro Real</option>
                </Sel>
              </Field>
              <Field label="Série NFC-e">
                <Inp type="number" min={1} max={999} value={form.nfceSerie} onChange={e => set("nfceSerie", Number(e.target.value))} />
              </Field>
              <Field label="CFOP Padrão">
                <Inp value={form.defaultCfop ?? "5102"} maxLength={10} onChange={e => set("defaultCfop", e.target.value)} />
              </Field>
            </div>
          </section>

          {/* CSC */}
          <section className={section} style={sectionStyle}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>CSC — Código de Segurança do Contribuinte</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CSC ID">
                <Inp value={form.cscId ?? ""} maxLength={10} placeholder="000001" onChange={e => set("cscId", e.target.value || null)} />
              </Field>
              <Field label="CSC Token">
                <Inp
                  value={form.cscToken ?? ""} maxLength={36}
                  placeholder="UUID fornecido pela SEFAZ"
                  onChange={e => set("cscToken", e.target.value || null)}
                />
              </Field>
            </div>
          </section>

          {/* Certificado */}
          <section className={section} style={sectionStyle}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Certificado Digital A1</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Selecione o arquivo .pfx/.p12. Ele será armazenado de forma segura no banco de dados (compatível com servidores cloud).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Arquivo do Certificado (.pfx/.p12)">
                <div className="flex gap-2">
                  <input
                    ref={certInputRef}
                    type="file"
                    accept=".pfx,.p12"
                    className="hidden"
                    onChange={handleCertFile}
                  />
                  <button
                    type="button"
                    onClick={() => certInputRef.current?.click()}
                    className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 text-sm border transition-all hover:opacity-80"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: certFileName || form.certificateBase64 ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {certFileName ?? (form.certificateBase64 ? "Certificado carregado" : "Selecionar arquivo...")}
                    </span>
                  </button>
                </div>
                {form.certificateBase64 && !certFileName && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Certificado já configurado. Selecione um novo arquivo para substituir.
                  </p>
                )}
              </Field>
              <Field label="Senha do Certificado">
                <Inp type="password" value={form.certificatePassword ?? ""} onChange={e => set("certificatePassword", e.target.value || null)} />
              </Field>
            </div>
          </section>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="flex items-center gap-2 h-9 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
            >
              <Save className="w-4 h-4" />
              {saveMut.isPending ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </form>

        {/* Documentos fiscais emitidos */}
        <section className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setShowDocs(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[rgba(124,92,248,0.06)]"
          >
            <span className="font-semibold" style={{ color: "var(--text)" }}>Documentos Fiscais Emitidos</span>
            {showDocs
              ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
          </button>

          {showDocs && (
            <div className="overflow-x-auto border-t" style={{ borderColor: "var(--border)" }}>
              {documents.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                  Nenhum documento fiscal emitido ainda.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>NFC-e</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Chave de Acesso</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc, i) => (
                      <tr
                        key={doc.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text)" }}>
                          {doc.serie}/{String(doc.number).padStart(9, "0")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.fiscalStatus ?? doc.status ?? ""] ?? "bg-gray-900/30 text-gray-400"}`}>
                            {doc.fiscalStatus ?? doc.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs max-w-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {doc.accessKey
                            ? doc.accessKey.replace(/(.{4})/g, "$1 ").trim()
                            : doc.rejectMessage ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                          {new Date(doc.createdAtUtc).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
