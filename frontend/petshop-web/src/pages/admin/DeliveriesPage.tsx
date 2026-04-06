import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { Loader2, Truck, Search, ChevronLeft, ChevronRight, MapPin } from "lucide-react";

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

interface DeliveryItem {
  id: string;
  publicId: string;
  customerName: string;
  phone: string;
  status: string;
  totalCents: number;
  paymentMethod: string;
  createdAtUtc: string;
  isTableOrder: boolean;
  tableId: string | null;
  tableNumber: number | null;
  tableName: string | null;
}

interface DeliveriesResponse {
  page: number;
  pageSize: number;
  total: number;
  items: DeliveryItem[];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function listDeliveries(params: {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<DeliveriesResponse> {
  const q = new URLSearchParams();
  q.set("page", String(params.page));
  q.set("pageSize", String(params.pageSize));
  q.set("channel", "delivery");
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.from)   q.set("from", params.from);
  if (params.to)     q.set("to", params.to);
  return adminFetch<DeliveriesResponse>(`/orders?${q.toString()}`);
}

// ── Status badges ─────────────────────────────────────────────────────────────

const statusLabel: Record<string, string> = {
  RECEBIDO:   "Recebido",
  CONFIRMADO: "Confirmado",
  ENTREGUE:   "Entregue",
  CANCELADO:  "Cancelado",
};

const statusClass: Record<string, string> = {
  RECEBIDO:   "bg-blue-100 text-blue-700",
  CONFIRMADO: "bg-yellow-100 text-yellow-800",
  ENTREGUE:   "bg-green-100 text-green-700",
  CANCELADO:  "bg-gray-100 text-gray-500",
};

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "open" | "delivered" | "all";

const TAB_CONFIG: Record<Tab, { label: string; statuses: string[] }> = {
  open:      { label: "Em aberto",   statuses: ["RECEBIDO", "CONFIRMADO"] },
  delivered: { label: "Concluídas",  statuses: ["ENTREGUE"] },
  all:       { label: "Todas",       statuses: [] },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [page, setPage]           = useState(1);
  const [pageSize]                 = useState(20);
  const [search, setSearch]        = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  const tabConfig = TAB_CONFIG[activeTab];

  // Para tabs com múltiplos status, fazemos uma query por status e concatenamos
  // Mas para simplicidade, vamos usar o primeiro status como filtro principal
  // e deixar "Todas" sem filtro de status
  const statusParam = tabConfig.statuses.length === 1 ? tabConfig.statuses[0] : undefined;

  const { data, isLoading, isError } = useQuery<DeliveriesResponse>({
    queryKey: ["deliveries", activeTab, page, pageSize, search, dateFrom, dateTo],
    queryFn: async () => {
      if (tabConfig.statuses.length <= 1) {
        return listDeliveries({
          page, pageSize,
          status: statusParam,
          search: search || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        });
      }

      // Para "Em aberto" (RECEBIDO + CONFIRMADO): buscar os dois e combinar
      const [r1, r2] = await Promise.all([
        listDeliveries({ page: 1, pageSize: 50, status: "RECEBIDO", search: search || undefined }),
        listDeliveries({ page: 1, pageSize: 50, status: "CONFIRMADO", search: search || undefined }),
      ]);
      // Combinar e paginar manualmente
      const combined = [...r1.items, ...r2.items]
        .sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
      const total = r1.total + r2.total;
      const start = (page - 1) * pageSize;
      return { page, pageSize, total, items: combined.slice(start, start + pageSize) };
    },
    staleTime: 20_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  function changeTab(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-semibold text-gray-800">Entregas</h1>
        {data && (
          <span className="ml-2 text-sm text-gray-500">
            {data.total.toLocaleString("pt-BR")} pedido(s)
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(Object.keys(TAB_CONFIG) as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => changeTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_CONFIG[tab].label}
          </button>
        ))}
      </div>

      {/* Busca e filtros de data */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID ou cliente..."
            value={pendingSearch}
            onChange={e => setPendingSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { setSearch(pendingSearch); setPage(1); }
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <span className="self-center text-gray-400 text-sm">até</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => { setSearch(pendingSearch); setPage(1); }}
          className="px-4 py-2 bg-brand text-white text-sm rounded-lg hover:brightness-110 transition"
        >
          Buscar
        </button>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">Erro ao carregar entregas.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>
            {activeTab === "open"
              ? "Nenhuma entrega em aberto no momento."
              : "Nenhuma entrega encontrada."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Data/Hora</th>
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Telefone</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Pagamento</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {fmtDateTime(order.createdAtUtc)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-700">{order.publicId}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {order.customerName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <a href={`tel:${order.phone}`} className="hover:text-brand transition">
                        {order.phone || "—"}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {brl(order.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {statusLabel[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/app/pedidos/${order.id}`)}
                        className="flex items-center gap-0.5 text-brand hover:underline text-xs ml-auto"
                      >
                        <MapPin className="w-3 h-3" />
                        Ver pedido
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
