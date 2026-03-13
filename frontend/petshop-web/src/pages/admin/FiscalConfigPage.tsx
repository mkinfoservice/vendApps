import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  getFiscalConfig, saveFiscalConfig, getSefazStatus,
  getFiscalDocuments,
  type FiscalConfigDto, type FiscalDocumentListItem,
} from "@/features/fiscal/fiscalApi";
import { FileText, Save, RefreshCw, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

const EMPTY_CONFIG: FiscalConfigDto = {
  cnpj: "", inscricaoEstadual: "", uf: "", razaoSocial: "",
  nomeFantasia: null, logradouro: "", numeroEndereco: "",
  complemento: null, bairro: "", codigoMunicipio: 0,
  nomeMunicipio: "", cep: "", telefone: null,
  taxRegime: "SimplesNacional", sefazEnvironment: "Homologacao",
  certificatePath: null, certificatePassword: null,
  cscId: null, cscToken: null, nfceSerie: 1, defaultCfop: "5102",
};

const STATUS_COLORS: Record<string, string> = {
  Authorized: "bg-green-100 text-green-700",
  Pending:    "bg-yellow-100 text-yellow-700",
  Rejected:   "bg-red-100 text-red-700",
  Contingency:"bg-orange-100 text-orange-700",
  Cancelled:  "bg-gray-100 text-gray-500",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand/30";
const SELECT = INPUT;

export default function FiscalConfigPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FiscalConfigDto>(EMPTY_CONFIG);
  const [showDocs, setShowDocs] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (config) setForm(config);
  }, [config]);

  const saveMut = useMutation({
    mutationFn: saveFiscalConfig,
    onSuccess: (data) => {
      qc.setQueryData(["fiscal-config"], data);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  function set(field: keyof FiscalConfigDto, value: string | number | null) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMut.mutate(form);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse h-8 bg-gray-200 rounded w-48 mb-4" />
          <div className="animate-pulse h-96 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Configuração Fiscal</h1>
              <p className="text-sm text-gray-500">NFC-e · SEFAZ · Certificado Digital</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => recheckSefaz()}
            disabled={checkingStatus}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${checkingStatus ? "animate-spin" : ""}`} />
            Status SEFAZ
          </button>
        </div>

        {/* SEFAZ status */}
        {sefazStatus && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${sefazStatus.online ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {sefazStatus.online
              ? <CheckCircle className="w-4 h-4" />
              : <XCircle className="w-4 h-4" />}
            SEFAZ {sefazStatus.uf || "—"}: {sefazStatus.online ? "On-line" : "Off-line"}
            <span className="ml-auto text-xs opacity-70">
              Verificado {new Date(sefazStatus.checkedAtUtc).toLocaleTimeString("pt-BR")}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Configuração salva com sucesso.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Dados da empresa */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Dados da Empresa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CNPJ (só dígitos)">
                <input className={INPUT} value={form.cnpj ?? ""} maxLength={14}
                  onChange={e => set("cnpj", e.target.value)} placeholder="00000000000000" />
              </Field>
              <Field label="Inscrição Estadual">
                <input className={INPUT} value={form.inscricaoEstadual ?? ""}
                  onChange={e => set("inscricaoEstadual", e.target.value)} />
              </Field>
              <Field label="Razão Social">
                <input className={INPUT} value={form.razaoSocial ?? ""} maxLength={60}
                  onChange={e => set("razaoSocial", e.target.value)} />
              </Field>
              <Field label="Nome Fantasia">
                <input className={INPUT} value={form.nomeFantasia ?? ""} maxLength={60}
                  onChange={e => set("nomeFantasia", e.target.value || null)} />
              </Field>
              <Field label="UF">
                <input className={INPUT} value={form.uf ?? ""} maxLength={2}
                  onChange={e => set("uf", e.target.value.toUpperCase())} placeholder="SP" />
              </Field>
              <Field label="Telefone">
                <input className={INPUT} value={form.telefone ?? ""} maxLength={14}
                  onChange={e => set("telefone", e.target.value || null)} placeholder="11999999999" />
              </Field>
            </div>
          </section>

          {/* Endereço */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Endereço do Estabelecimento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Logradouro">
                <input className={INPUT} value={form.logradouro ?? ""} maxLength={60}
                  onChange={e => set("logradouro", e.target.value)} />
              </Field>
              <Field label="Número">
                <input className={INPUT} value={form.numeroEndereco ?? ""} maxLength={60}
                  onChange={e => set("numeroEndereco", e.target.value)} />
              </Field>
              <Field label="Complemento">
                <input className={INPUT} value={form.complemento ?? ""}
                  onChange={e => set("complemento", e.target.value || null)} />
              </Field>
              <Field label="Bairro">
                <input className={INPUT} value={form.bairro ?? ""} maxLength={60}
                  onChange={e => set("bairro", e.target.value)} />
              </Field>
              <Field label="Município">
                <input className={INPUT} value={form.nomeMunicipio ?? ""} maxLength={60}
                  onChange={e => set("nomeMunicipio", e.target.value)} />
              </Field>
              <Field label="Código IBGE do Município">
                <input className={INPUT} type="number" value={form.codigoMunicipio}
                  onChange={e => set("codigoMunicipio", Number(e.target.value))} placeholder="3550308" />
              </Field>
              <Field label="CEP (só dígitos)">
                <input className={INPUT} value={form.cep ?? ""} maxLength={8}
                  onChange={e => set("cep", e.target.value)} placeholder="01310100" />
              </Field>
            </div>
          </section>

          {/* SEFAZ / Tributação */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">SEFAZ &amp; Tributação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Ambiente">
                <select className={SELECT} value={form.sefazEnvironment ?? "Homologacao"}
                  onChange={e => set("sefazEnvironment", e.target.value)}>
                  <option value="Homologacao">Homologação</option>
                  <option value="Producao">Produção</option>
                </select>
              </Field>
              <Field label="Regime Tributário">
                <select className={SELECT} value={form.taxRegime ?? "SimplesNacional"}
                  onChange={e => set("taxRegime", e.target.value)}>
                  <option value="SimplesNacional">Simples Nacional</option>
                  <option value="LucroPresumido">Lucro Presumido</option>
                  <option value="LucroReal">Lucro Real</option>
                </select>
              </Field>
              <Field label="Série NFC-e">
                <input className={INPUT} type="number" min={1} max={999}
                  value={form.nfceSerie}
                  onChange={e => set("nfceSerie", Number(e.target.value))} />
              </Field>
              <Field label="CFOP Padrão">
                <input className={INPUT} value={form.defaultCfop ?? "5102"} maxLength={10}
                  onChange={e => set("defaultCfop", e.target.value)} />
              </Field>
            </div>
          </section>

          {/* CSC */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">CSC — Código de Segurança do Contribuinte</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CSC ID">
                <input className={INPUT} value={form.cscId ?? ""} maxLength={10}
                  onChange={e => set("cscId", e.target.value || null)} placeholder="000001" />
              </Field>
              <Field label="CSC Token">
                <input className={INPUT} value={form.cscToken ?? ""} maxLength={36}
                  onChange={e => set("cscToken", e.target.value || null)} placeholder="UUID ou código fornecido pela SEFAZ" />
              </Field>
            </div>
          </section>

          {/* Certificado */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Certificado Digital A1</h2>
            <p className="text-xs text-gray-500">
              O arquivo .pfx/.p12 deve estar acessível ao servidor. Informe o caminho absoluto no sistema de arquivos do servidor.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Caminho do Certificado (.pfx/.p12)">
                <input className={INPUT} value={form.certificatePath ?? ""}
                  onChange={e => set("certificatePath", e.target.value || null)}
                  placeholder="/certs/empresa.pfx" />
              </Field>
              <Field label="Senha do Certificado">
                <input className={INPUT} type="password" value={form.certificatePassword ?? ""}
                  onChange={e => set("certificatePassword", e.target.value || null)} />
              </Field>
            </div>
          </section>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMut.isPending ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </form>

        {/* Documentos fiscais emitidos */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDocs(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
          >
            <span className="font-semibold text-gray-800">Documentos Fiscais Emitidos</span>
            {showDocs ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showDocs && (
            <div className="overflow-x-auto border-t border-gray-100">
              {documents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum documento fiscal emitido ainda.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">NFC-e</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Chave de Acesso</th>
                      <th className="px-4 py-3 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {documents.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-mono text-xs">
                          {doc.serie}/{String(doc.number).padStart(9, "0")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.fiscalStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {doc.fiscalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-xs truncate">
                          {doc.accessKey
                            ? doc.accessKey.replace(/(.{4})/g, "$1 ").trim()
                            : doc.rejectMessage ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
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
