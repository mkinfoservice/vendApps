import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Loader2, Plus, Pencil, Building2, Receipt } from "lucide-react";

// ── API ───────────────────────────────────────────────────────────────────────

export interface CashRegisterDto {
  id: string;
  name: string;
  fiscalSerie: string;
  fiscalAutoIssuePix: boolean;
  fiscalSendCashToSefaz: boolean;
  isActive: boolean;
}

export interface CashRegisterFiscalConfigDto {
  cnpj?: string;
  inscricaoEstadual?: string;
  uf?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  logradouro?: string;
  numeroEndereco?: string;
  complemento?: string;
  bairro?: string;
  codigoMunicipio?: number;
  nomeMunicipio?: string;
  cep?: string;
  telefone?: string;
  taxRegime?: string;
  sefazEnvironment?: string;
  certificateBase64?: string;
  certificatePassword?: string;
  cscId?: string;
  cscToken?: string;
  nfceSerie?: number;
  defaultCfop?: string;
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

function getFiscalConfig(id: string): Promise<CashRegisterFiscalConfigDto> {
  return adminFetch<CashRegisterFiscalConfigDto>(`/admin/cash-registers/${id}/fiscal`);
}

function saveFiscalConfig(id: string, body: CashRegisterFiscalConfigDto): Promise<CashRegisterFiscalConfigDto> {
  return adminFetch<CashRegisterFiscalConfigDto>(`/admin/cash-registers/${id}/fiscal`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";

const selectCls =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  item: CashRegisterDto | null;
  onClose: () => void;
}

function RegisterModal({ item, onClose }: ModalProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"terminal" | "fiscal">("terminal");

  // Terminal fields
  const [name, setName]           = useState(item?.name ?? "");
  const [serie, setSerie]         = useState(item?.fiscalSerie ?? "001");
  const [autoPix, setAutoPix]     = useState(item?.fiscalAutoIssuePix ?? true);
  const [sendCash, setSendCash]   = useState(item?.fiscalSendCashToSefaz ?? false);
  const [isActive, setIsActive]   = useState(item?.isActive ?? true);
  const [termError, setTermError] = useState<string | null>(null);

  // Fiscal fields
  const [fiscal, setFiscal] = useState<CashRegisterFiscalConfigDto>({
    taxRegime: "SimplesNacional",
    sefazEnvironment: "Homologacao",
    nfceSerie: 1,
    defaultCfop: "5102",
  });
  const [fiscalLoaded, setFiscalLoaded] = useState(false);
  const [fiscalError, setFiscalError]   = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState<string>("");
  const certInputRef = useRef<HTMLInputElement>(null);

  // Load fiscal config when switching to fiscal tab (edit mode only)
  function handleTabFiscal() {
    if (!item) return;
    setTab("fiscal");
    if (!fiscalLoaded) {
      getFiscalConfig(item.id)
        .then((cfg) => { setFiscal(cfg); setFiscalLoaded(true); })
        .catch(() => setFiscalLoaded(true));
    }
  }

  function setF<K extends keyof CashRegisterFiscalConfigDto>(k: K, v: CashRegisterFiscalConfigDto[K]) {
    setFiscal((prev) => ({ ...prev, [k]: v }));
  }

  // Terminal save
  const termMut = useMutation({
    mutationFn: async () => {
      if (item) {
        await updateRegister(item.id, { name, fiscalSerie: serie, fiscalAutoIssuePix: autoPix, fiscalSendCashToSefaz: sendCash, isActive });
      } else {
        await createRegister({ name, fiscalSerie: serie, fiscalAutoIssuePix: autoPix, fiscalSendCashToSefaz: sendCash });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cash-registers"] }); onClose(); },
    onError: (e: Error) => setTermError(e.message),
  });

  // Fiscal save
  const fiscalMut = useMutation({
    mutationFn: () => saveFiscalConfig(item!.id, fiscal),
    onSuccess: (updated) => { setFiscal(updated); setFiscalError(null); },
    onError: (e: Error) => setFiscalError(e.message),
  });

  // Certificate file → base64
  function handleCertFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setF("certificateBase64", b64);
    };
    reader.readAsDataURL(file);
  }

  const termOk = name.trim().length > 0 && serie.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{item ? `Editar: ${item.name}` : "Novo Terminal"}</h2>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setTab("terminal")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${tab === "terminal" ? "bg-white shadow text-[#7c5cf8] font-semibold" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Receipt size={13} /> Terminal
            </button>
            <button
              onClick={handleTabFiscal}
              disabled={!item}
              title={!item ? "Salve o terminal primeiro para configurar o fiscal" : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${tab === "fiscal" ? "bg-white shadow text-[#7c5cf8] font-semibold" : "text-gray-500 hover:text-gray-700"} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Building2 size={13} /> Fiscal / CNPJ
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── TAB: TERMINAL ─────────────────────────────────────────── */}
          {tab === "terminal" && (
            <div className="space-y-4">
              <Field label="Nome do terminal *">
                <input
                  className={inputCls}
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Caixa 1, PDV Balcão"
                  autoFocus
                />
              </Field>

              <Field label="Série fiscal NFC-e">
                <input
                  maxLength={3}
                  className={inputCls}
                  value={serie} onChange={(e) => setSerie(e.target.value)}
                />
              </Field>

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

              {!item && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  Após criar o terminal, clique em "Fiscal / CNPJ" para configurar os dados da empresa vinculada a este caixa.
                </p>
              )}

              {termError && <p className="text-xs text-red-500">{termError}</p>}
            </div>
          )}

          {/* ── TAB: FISCAL ───────────────────────────────────────────── */}
          {tab === "fiscal" && (
            <div className="space-y-5">

              {/* Empresa */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Dados da Empresa</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CNPJ *">
                    <input className={inputCls} placeholder="00.000.000/0000-00"
                      value={fiscal.cnpj ?? ""} onChange={(e) => setF("cnpj", e.target.value)} />
                  </Field>
                  <Field label="Inscrição Estadual">
                    <input className={inputCls} placeholder="Isento ou número"
                      value={fiscal.inscricaoEstadual ?? ""} onChange={(e) => setF("inscricaoEstadual", e.target.value)} />
                  </Field>
                  <Field label="Razão Social *">
                    <input className={inputCls}
                      value={fiscal.razaoSocial ?? ""} onChange={(e) => setF("razaoSocial", e.target.value)} />
                  </Field>
                  <Field label="Nome Fantasia">
                    <input className={inputCls}
                      value={fiscal.nomeFantasia ?? ""} onChange={(e) => setF("nomeFantasia", e.target.value)} />
                  </Field>
                  <Field label="UF *">
                    <input className={inputCls} maxLength={2} placeholder="RJ"
                      value={fiscal.uf ?? ""} onChange={(e) => setF("uf", e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Telefone">
                    <input className={inputCls} placeholder="(21) 99999-9999"
                      value={fiscal.telefone ?? ""} onChange={(e) => setF("telefone", e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Field label="Logradouro *">
                      <input className={inputCls}
                        value={fiscal.logradouro ?? ""} onChange={(e) => setF("logradouro", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Número *">
                    <input className={inputCls}
                      value={fiscal.numeroEndereco ?? ""} onChange={(e) => setF("numeroEndereco", e.target.value)} />
                  </Field>
                  <Field label="Complemento">
                    <input className={inputCls}
                      value={fiscal.complemento ?? ""} onChange={(e) => setF("complemento", e.target.value)} />
                  </Field>
                  <Field label="Bairro *">
                    <input className={inputCls}
                      value={fiscal.bairro ?? ""} onChange={(e) => setF("bairro", e.target.value)} />
                  </Field>
                  <Field label="CEP *">
                    <input className={inputCls} placeholder="00000-000"
                      value={fiscal.cep ?? ""} onChange={(e) => setF("cep", e.target.value)} />
                  </Field>
                  <Field label="Município *">
                    <input className={inputCls}
                      value={fiscal.nomeMunicipio ?? ""} onChange={(e) => setF("nomeMunicipio", e.target.value)} />
                  </Field>
                  <Field label="Código Município (IBGE)">
                    <input className={inputCls} type="number" placeholder="3304557"
                      value={fiscal.codigoMunicipio ?? ""} onChange={(e) => setF("codigoMunicipio", Number(e.target.value))} />
                  </Field>
                </div>
              </div>

              {/* Fiscal */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Configuração Fiscal</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Regime Tributário">
                    <select className={selectCls}
                      value={fiscal.taxRegime ?? "SimplesNacional"}
                      onChange={(e) => setF("taxRegime", e.target.value)}>
                      <option value="SimplesNacional">Simples Nacional</option>
                      <option value="LucroPresumido">Lucro Presumido</option>
                      <option value="LucroReal">Lucro Real</option>
                    </select>
                  </Field>
                  <Field label="Ambiente SEFAZ">
                    <select className={selectCls}
                      value={fiscal.sefazEnvironment ?? "Homologacao"}
                      onChange={(e) => setF("sefazEnvironment", e.target.value)}>
                      <option value="Homologacao">Homologação</option>
                      <option value="Producao">Produção</option>
                    </select>
                  </Field>
                  <Field label="Série NFC-e">
                    <input className={inputCls} type="number" min={1} max={999}
                      value={fiscal.nfceSerie ?? 1} onChange={(e) => setF("nfceSerie", Number(e.target.value))} />
                  </Field>
                  <Field label="CFOP padrão">
                    <input className={inputCls} maxLength={4} placeholder="5102"
                      value={fiscal.defaultCfop ?? "5102"} onChange={(e) => setF("defaultCfop", e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* CSC */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">CSC (Código de Segurança do Contribuinte)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CSC ID">
                    <input className={inputCls} placeholder="000001"
                      value={fiscal.cscId ?? ""} onChange={(e) => setF("cscId", e.target.value)} />
                  </Field>
                  <Field label="CSC Token">
                    <input className={inputCls} placeholder="Token CSC"
                      value={fiscal.cscToken ?? ""} onChange={(e) => setF("cscToken", e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Certificado */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Certificado Digital (A1 .pfx)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Field label="Arquivo .pfx">
                      <div className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => certInputRef.current?.click()}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-700"
                        >
                          Selecionar arquivo
                        </button>
                        <span className="text-sm text-gray-500 truncate max-w-xs">
                          {certFileName || (fiscal.certificateBase64 ? "Certificado carregado" : "Nenhum arquivo selecionado")}
                        </span>
                        <input ref={certInputRef} type="file" accept=".pfx,.p12" className="hidden" onChange={handleCertFile} />
                      </div>
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Senha do certificado">
                      <input className={inputCls} type="password" placeholder="Senha do .pfx"
                        value={fiscal.certificatePassword ?? ""} onChange={(e) => setF("certificatePassword", e.target.value)} />
                    </Field>
                  </div>
                </div>
              </div>

              {fiscalMut.isSuccess && (
                <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">Configuração fiscal salva com sucesso.</p>
              )}
              {fiscalError && <p className="text-xs text-red-500">{fiscalError}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            {tab === "fiscal" ? "Fechar" : "Cancelar"}
          </button>

          {tab === "terminal" && (
            <button
              disabled={!termOk || termMut.isPending}
              onClick={() => termMut.mutate()}
              className="flex-1 py-2 text-sm font-semibold rounded-xl text-white bg-[#7c5cf8] hover:brightness-110 disabled:opacity-40 transition"
            >
              {termMut.isPending ? "Salvando..." : "Salvar Terminal"}
            </button>
          )}

          {tab === "fiscal" && (
            <button
              disabled={fiscalMut.isPending}
              onClick={() => fiscalMut.mutate()}
              className="flex-1 py-2 text-sm font-semibold rounded-xl text-white bg-[#7c5cf8] hover:brightness-110 disabled:opacity-40 transition"
            >
              {fiscalMut.isPending ? "Salvando..." : "Salvar Configuração Fiscal"}
            </button>
          )}
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
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
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
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center" style={{ color: "var(--text-muted)" }}>
                      Nenhum terminal cadastrado.
                    </td>
                  </tr>
                )}
                {registers.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t transition"
                    style={{ borderColor: "var(--border)" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "")}
                  >
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
                      <button onClick={() => setEditing(r)} className="transition" style={{ color: "var(--text-muted)" }}>
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
