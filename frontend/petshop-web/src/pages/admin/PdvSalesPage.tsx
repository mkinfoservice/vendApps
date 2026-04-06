import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Loader2, Receipt, Search, Filter, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FiscalSummary {
  id: string;
  number: number;
  serie: number;
  accessKey: string | null;
  fiscalStatus: string;
  contingencyType: string;
  isContingency: boolean;
  authorizedAt: string | null;
  rejectCode: string | null;
}

interface PdvSaleItem {
  id: string;
  publicId: string;
  cashRegisterNameSnapshot: string | null;
  operatorName: string | null;
  customerName: string;
  customerPhone: string | null;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  fiscalDecision: string;
  fromDav: boolean;
  createdAtUtc: string;
  completedAtUtc: string | null;
  cancelledAtUtc: string | null;
  fiscal: FiscalSummary | null;
}

interface PdvSalesResponse {
  page: number;
  pageSize: number;
  total: number;
  items: PdvSaleItem[];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function listPdvSales(params: {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  fiscalStatus?: string;
  from?: string;
  to?: string;
}): Promise<PdvSalesResponse> {
  const q = new URLSearchParams();
  q.set("page", String(params.page));
  q.set("pageSize", String(params.pageSize));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.fiscalStatus) q.set("fiscalStatus", params.fiscalStatus);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  return adminFetch<PdvSalesResponse>(`/pdv/sales?${q.toString()}`);
}

// ── Status badges ─────────────────────────────────────────────────────────────

const saleStatusLabel: Record<string, string> = {
  Open: "Em aberto", Completed: "Concluída", Cancelled: "Cancelada", Voided: "Estornada",
};

const saleStatusClass: Record<string, string> = {
  Open:      "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800",
  Cancelled: "bg-gray-100 text-gray-600",
  Voided:    "bg-red-100 text-red-700",
};

const fiscalStatusLabel: Record<string, string> = {
  Authorized:   "Autorizada",
  Pending:      "Pendente",
  Rejected:     "Rejeitada",
  Contingency:  "Contingência",
  Cancelled:    "Cancelada",
};

const fiscalStatusClass: Record<string, string> = {
  Authorized:  "bg-green-100 text-green-700",
  Pending:     "bg-yellow-100 text-yellow-700",
  Rejected:    "bg-red-100 text-red-700",
  Contingency: "bg-orange-100 text-orange-700",
  Cancelled:   "bg-gray-100 text-gray-500",
};

function FiscalBadge({ fiscal }: { fiscal: FiscalSummary | null }) {
  if (!fiscal)
    return <span className="text-xs text-gray-400">Sem NF</span>;

  const label = (fiscal.isContingency ? "⚠ " : "") + (fiscalStatusLabel[fiscal.fiscalStatus] ?? fiscal.fiscalStatus);
  const cls   = fiscalStatusClass[fiscal.fiscalStatus] ?? "bg-gray-100 text-gray-600";
  const title = fiscal.accessKey ? `Chave: ${fiscal.accessKey}` : undefined;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`} title={title}>
      {label}
      {fiscal.number ? ` #${fiscal.number}` : ""}
    </span>
  );
}

// ── Filtros ───────────────────────────────────────────────────────────────────

interface FiltersState {
  status: string;
  fiscalStatus: string;
  search: string;
  from: string;
  to: string;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PdvSalesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [page, setPage]         = useState(1);
  const [pageSize]               = useState(20);
  const [filters, setFilters]   = useState<FiltersState>({
    status:       "",
    fiscalStatus: "",
    search:       searchParams.get("search") ?? "",
    from:         "",
    to:           "",
  });
  const [pendingSearch, setPendingSearch] = useState(filters.search);
  const [showFilters, setShowFilters]     = useState(false);

  const { data, isLoading, isError } = useQuery<PdvSalesResponse>({
    queryKey: ["pdv-sales", page, pageSize, filters],
    queryFn: () => listPdvSales({
      page,
      pageSize,
      status:       filters.status || undefined,
      search:       filters.search || undefined,
      fiscalStatus: filters.fiscalStatus || undefined,
      from:         filters.from || undefined,
      to:           filters.to || undefined,
    }),
    staleTime: 30_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  function applySearch() {
    setFilters(f => ({ ...f, search: pendingSearch }));
    setPage(1);
  }

  function updateFilter(key: keyof FiltersState, value: string) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand" />
          <h1 className="text-xl font-semibold text-gray-800">Vendas do Caixa (PDV)</h1>
          {data && (
            <span className="ml-2 text-sm text-gray-500">
              {data.total.toLocaleString("pt-BR")} venda(s)
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

      {/* Barra de busca */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID da venda ou nome do cliente..."
            value={pendingSearch}
            onChange={e => setPendingSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applySearch()}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <button
          onClick={applySearch}
          className="px-4 py-2 bg-brand text-white text-sm rounded-lg hover:brightness-110 transition"
        >
          Buscar
        </button>
      </div>

      {/* Painel de filtros avançados */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl mb-4 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status da venda</label>
            <select
              value={filters.status}
              onChange={e => updateFilter("status", e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5"
            >
              <option value="">Todos</option>
              <option value="Completed">Concluída</option>
              <option value="Open">Em aberto</option>
              <option value="Cancelled">Cancelada</option>
              <option value="Voided">Estornada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status fiscal</label>
            <select
              value={filters.fiscalStatus}
              onChange={e => updateFilter("fiscalStatus", e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5"
            >
              <option value="">Todos</option>
              <option value="Authorized">Autorizada</option>
              <option value="Pending">Pendente</option>
              <option value="Rejected">Rejeitada</option>
              <option value="Contingency">Contingência</option>
              <option value="None">Sem NF</option>
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
        <div className="text-center py-12 text-red-500">Erro ao carregar vendas.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma venda encontrada.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Data/Hora</th>
                  <th className="px-4 py-3 text-left">Venda</th>
                  <th className="px-4 py-3 text-left">Operador / Terminal</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Desconto</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Fiscal</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {fmtDateTime(sale.createdAtUtc)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-700">{sale.publicId}</span>
                      {sale.fromDav && (
                        <span className="ml-1 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">DAV</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{sale.operatorName ?? <span className="text-gray-400">—</span>}</div>
                      {sale.cashRegisterNameSnapshot && (
                        <div className="text-xs text-gray-400">{sale.cashRegisterNameSnapshot}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {sale.customerName || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {brl(sale.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {sale.discountCents > 0 ? (
                        <span className="text-red-500">-{brl(sale.discountCents)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${saleStatusClass[sale.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {saleStatusLabel[sale.status] ?? sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FiscalBadge fiscal={sale.fiscal} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/app/caixa/vendas/${sale.id}`)}
                        className="text-brand hover:underline text-xs flex items-center gap-0.5 ml-auto"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver
                      </button>
                    </td>
                  </tr>
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
