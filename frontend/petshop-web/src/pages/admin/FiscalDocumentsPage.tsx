import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Loader2, FileText, Filter, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtAccessKey(key: string | null) {
  if (!key) return "—";
  // Formatar chave de 44 dígitos em blocos de 4 para legibilidade
  return key.match(/.{1,4}/g)?.join(" ") ?? key;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FiscalDocumentItem {
  id: string;
  number: number;
  serie: number;
  accessKey: string | null;
  fiscalStatus: string;
  contingencyType: string;
  isContingency: boolean;
  saleOrderId: string | null;
  salePublicId: string | null;
  rejectCode: string | null;
  rejectMessage: string | null;
  transmissionAttempts: number;
  authorizationDateTimeUtc: string | null;
  lastAttemptAtUtc: string | null;
  createdAtUtc: string;
  hasXml: boolean;
}

interface FiscalDocumentsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: FiscalDocumentItem[];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function listFiscalDocuments(params: {
  page: number;
  pageSize: number;
  status?: string;
  contingency?: string;
  from?: string;
  to?: string;
}): Promise<FiscalDocumentsResponse> {
  const q = new URLSearchParams();
  q.set("page", String(params.page));
  q.set("pageSize", String(params.pageSize));
  if (params.status)      q.set("status", params.status);
  if (params.contingency) q.set("contingency", params.contingency);
  if (params.from)        q.set("from", params.from);
  if (params.to)          q.set("to", params.to);
  return adminFetch<FiscalDocumentsResponse>(`/admin/fiscal/documents?${q.toString()}`);
}

// ── Status badges ─────────────────────────────────────────────────────────────

const fiscalStatusLabel: Record<string, string> = {
  Authorized:  "Autorizada",
  Pending:     "Pendente",
  Rejected:    "Rejeitada",
  Contingency: "Contingência",
  Cancelled:   "Cancelada",
};

const fiscalStatusClass: Record<string, string> = {
  Authorized:  "bg-green-100 text-green-700",
  Pending:     "bg-yellow-100 text-yellow-800",
  Rejected:    "bg-red-100 text-red-700",
  Contingency: "bg-orange-100 text-orange-700",
  Cancelled:   "bg-gray-100 text-gray-500",
};

// ── Row expandido ──────────────────────────────────────────────────────────────

function ExpandedRow({ doc }: { doc: FiscalDocumentItem }) {
  return (
    <tr className="bg-amber-50/50">
      <td colSpan={8} className="px-6 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-gray-500 block mb-1">Chave de Acesso</span>
            <span className="font-mono text-xs text-gray-700 break-all">
              {fmtAccessKey(doc.accessKey)}
            </span>
          </div>
          {doc.rejectCode && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Rejeição SEFAZ</span>
              <span className="text-red-600 font-medium">
                [{doc.rejectCode}] {doc.rejectMessage}
              </span>
            </div>
          )}
          <div className="flex gap-6 text-xs text-gray-600">
            <span>Tentativas de transmissão: <strong>{doc.transmissionAttempts}</strong></span>
            <span>Última tentativa: <strong>{fmtDateTime(doc.lastAttemptAtUtc)}</strong></span>
            <span>XML: <strong>{doc.hasXml ? "Disponível" : "Ausente"}</strong></span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function FiscalDocumentsPage() {
  const [page, setPage]         = useState(1);
  const [pageSize]               = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filters, setFilters]   = useState({
    status:      "",
    contingency: "",
    from:        "",
    to:          "",
  });

  const { data, isLoading, isError } = useQuery<FiscalDocumentsResponse>({
    queryKey: ["fiscal-documents", page, pageSize, filters],
    queryFn: () => listFiscalDocuments({
      page,
      pageSize,
      status:      filters.status || undefined,
      contingency: filters.contingency || undefined,
      from:        filters.from || undefined,
      to:          filters.to || undefined,
    }),
    staleTime: 30_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }

  const contingencyCount = data?.items.filter(d => d.isContingency).length ?? 0;
  const pendingCount     = data?.items.filter(d => d.fiscalStatus === "Pending").length ?? 0;
  const rejectedCount    = data?.items.filter(d => d.fiscalStatus === "Rejected").length ?? 0;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand" />
          <h1 className="text-xl font-semibold text-gray-800">Documentos Fiscais (NFC-e)</h1>
          {data && (
            <span className="ml-2 text-sm text-gray-500">
              {data.total.toLocaleString("pt-BR")} documento(s)
            </span>
          )}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-brand transition"
        >
          <Filter className="w-4 h-4" />
          Filtros
        </button>
      </div>

      {/* Alertas rápidos */}
      {(contingencyCount > 0 || pendingCount > 0 || rejectedCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {contingencyCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
              <AlertTriangle className="w-4 h-4" />
              {contingencyCount} em contingência (transmitir em até 168h)
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              {pendingCount} pendente(s) de transmissão
            </div>
          )}
          {rejectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" />
              {rejectedCount} rejeitada(s) — verificar código de erro
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl mb-4 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status fiscal</label>
            <select
              value={filters.status}
              onChange={e => updateFilter("status", e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5"
            >
              <option value="">Todos</option>
              <option value="Authorized">Autorizada</option>
              <option value="Pending">Pendente</option>
              <option value="Rejected">Rejeitada</option>
              <option value="Contingency">Contingência</option>
              <option value="Cancelled">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contingência</label>
            <select
              value={filters.contingency}
              onChange={e => updateFilter("contingency", e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5"
            >
              <option value="">Todas</option>
              <option value="None">Sem contingência</option>
              <option value="Offline">Offline (FS-DA)</option>
              <option value="SvCan">SVC-AN</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input
              type="date"
              value={filters.from}
              onChange={e => updateFilter("from", e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input
              type="date"
              value={filters.to}
              onChange={e => updateFilter("to", e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5"
            />
          </div>
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">Erro ao carregar documentos fiscais.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum documento fiscal encontrado.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Emissão</th>
                  <th className="px-4 py-3 text-left">Nº / Série</th>
                  <th className="px-4 py-3 text-left">Venda vinculada</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Contingência</th>
                  <th className="px-4 py-3 text-left">Autorização</th>
                  <th className="px-4 py-3 text-center">XML</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(doc => (
                  <>
                    <tr key={doc.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {fmtDateTime(doc.createdAtUtc)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-800">{doc.number}</span>
                        <span className="text-xs text-gray-400 ml-1">/ {doc.serie}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {doc.salePublicId ?? (doc.saleOrderId ? doc.saleOrderId.slice(0, 8) + "…" : "—")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fiscalStatusClass[doc.fiscalStatus] ?? "bg-gray-100 text-gray-600"}`}>
                          {fiscalStatusLabel[doc.fiscalStatus] ?? doc.fiscalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {doc.isContingency ? (
                          <span className="flex items-center justify-center gap-1 text-orange-600 text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            {doc.contingencyType}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {fmtDateTime(doc.authorizationDateTimeUtc)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {doc.hasXml ? (
                          <span className="text-green-600 text-xs font-medium">✓</span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                          className="text-brand hover:underline text-xs"
                        >
                          {expandedId === doc.id ? "Fechar" : "Detalhes"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === doc.id && <ExpandedRow key={`exp-${doc.id}`} doc={doc} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
              {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, data.total)} de {data.total.toLocaleString("pt-BR")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
