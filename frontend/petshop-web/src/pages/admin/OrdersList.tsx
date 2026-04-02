import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDeleteAllDeliveries, useDeleteFinalizedDeliveries, useOrders } from "@/features/admin/orders/queries";
import { type OrderStatus } from "@/features/admin/orders/status";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Plus, ShoppingBag, Search, Trash2, Monitor, Coffee } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/features/admin/auth/adminFetch";
import { fetchTenantInfo, resolveTenantFromHost } from "@/utils/tenant";

const GC = { caramel: "#C8953A", brown: "#6B4F3A", dark: "#1C1209" };

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

// ── PDV Sales types & query ──────────────────────────────────────────────────

type PdvSaleItem = {
  id: string;
  publicId: string;
  customerName: string;
  customerPhone: string | null;
  status: string;
  totalCents: number;
  createdAtUtc: string;
  completedAtUtc: string | null;
  fromDav: boolean;
};

type ListPdvSalesResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: PdvSaleItem[];
};

function fetchPdvSales(page: number, pageSize: number, status?: string, search?: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  return adminFetch<ListPdvSalesResponse>(`/pdv/sales?${params.toString()}`);
}

function usePdvSales(page: number, pageSize: number, status?: string, search?: string) {
  return useQuery({
    queryKey: ["pdv-sales", page, pageSize, status ?? "", search ?? ""],
    queryFn: () => fetchPdvSales(page, pageSize, status, search),
  });
}

// ── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "RECEBIDO", label: "Recebido" },
  { value: "EM_PREPARO", label: "Em preparo" },
  { value: "PRONTO_PARA_ENTREGA", label: "Pronto para entrega" },
  { value: "SAIU_PARA_ENTREGA", label: "Saiu para entrega" },
  { value: "ENTREGUE", label: "Entregue" },
  { value: "CANCELADO", label: "Cancelado" },
];

const PDV_STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "Open", label: "Aberta" },
  { value: "Completed", label: "Concluída" },
  { value: "Cancelled", label: "Cancelada" },
];

function pdvStatusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    Open:      { label: "Aberta",    bg: "rgba(200,149,58,0.15)", color: GC.caramel },
    Completed: { label: "Paga",      bg: "rgba(16,185,129,0.15)", color: "#10b981" },
    Cancelled: { label: "Cancelada", bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
  };
  const s = map[status] ?? { label: status, bg: "rgba(107,79,58,0.12)", color: GC.brown };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrdersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useCurrentUser();

  const tenantSlug = resolveTenantFromHost();
  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenantInfo,
    enabled: !!tenantSlug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const ownDelivery = (tenantQuery.data?.features?.["own_delivery"] ?? true) === true;

  const [tab, setTab] = useState<"orders" | "pdv">("orders");

  // orders tab state
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">((searchParams.get("status") as OrderStatus) || "");
  const [search, setSearch] = useState("");

  // pdv tab state
  const [pdvPage, setPdvPage] = useState(1);
  const [pdvStatus, setPdvStatus] = useState("");
  const [pdvSearch, setPdvSearch] = useState("");

  const ordersQuery = useOrders(page, 20, status || undefined, search || undefined);
  const pdvQuery = usePdvSales(pdvPage, 20, pdvStatus || undefined, pdvSearch || undefined);
  const deleteAllDeliveriesMut = useDeleteAllDeliveries();
  const deleteFinalizedDeliveriesMut = useDeleteFinalizedDeliveries();

  const totalPages = useMemo(() => {
    if (!ordersQuery.data) return 1;
    return Math.max(1, Math.ceil(ordersQuery.data.total / ordersQuery.data.pageSize));
  }, [ordersQuery.data]);

  const pdvTotalPages = useMemo(() => {
    if (!pdvQuery.data) return 1;
    return Math.max(1, Math.ceil(pdvQuery.data.total / pdvQuery.data.pageSize));
  }, [pdvQuery.data]);

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const pdvItems = pdvQuery.data?.items ?? [];
  const pdvTotal = pdvQuery.data?.total ?? 0;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        <PageHeader
          title="Pedidos"
          subtitle={tab === "orders"
            ? (ordersQuery.isLoading ? "Carregando..." : `${total} pedido${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`)
            : (pdvQuery.isLoading ? "Carregando..." : `${pdvTotal} venda${pdvTotal !== 1 ? "s" : ""} no PDV`)}
          actions={
            <div className="flex items-center gap-2">
              {role === "admin" && tab === "orders" && (
                <>
                  <button type="button"
                    onClick={async () => {
                      if (!confirm("Apagar entregas encerradas (ENTREGUE e CANCELADO)?")) return;
                      try {
                        const res = await deleteFinalizedDeliveriesMut.mutateAsync();
                        alert(`Pedidos apagados: ${res.deletedOrders}`);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Erro ao apagar entregas encerradas.");
                      }
                    }}
                    disabled={deleteFinalizedDeliveriesMut.isPending}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)" }}>
                    <Trash2 size={15} />
                    {deleteFinalizedDeliveriesMut.isPending ? "Apagando..." : "Apagar encerradas"}
                  </button>
                  <button type="button"
                    onClick={async () => {
                      if (!confirm("Apagar TODOS os registros de entregas/pedidos desta empresa? Esta ação não pode ser desfeita.")) return;
                      try {
                        const res = await deleteAllDeliveriesMut.mutateAsync();
                        alert(`Pedidos apagados: ${res.deletedOrders}`);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Erro ao apagar registros.");
                      }
                    }}
                    disabled={deleteAllDeliveriesMut.isPending}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #b42318 0%, #ef4444 100%)" }}>
                    <Trash2 size={15} />
                    {deleteAllDeliveriesMut.isPending ? "Apagando..." : "Apagar tudo"}
                  </button>
                </>
              )}
              {tab === "orders" && ownDelivery && (
                <button type="button"
                  onClick={() => navigate("/app/logistica/rotas/planner")}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
                  <Plus size={15} />
                  Criar rota
                </button>
              )}
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4 w-fit"
          style={{ background: "var(--surface-2)" }}>
          <button onClick={() => setTab("orders")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === "orders"
              ? { background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, color: "#fff" }
              : { color: "var(--text-muted)" }}>
            <ShoppingBag size={14} />
            Delivery / Balcão
          </button>
          <button onClick={() => setTab("pdv")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === "pdv"
              ? { background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, color: "#fff" }
              : { color: "var(--text-muted)" }}>
            <Monitor size={14} />
            Frente de Caixa
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border p-4 mb-4 flex flex-col sm:flex-row gap-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }} />
            <input
              className="h-10 w-full rounded-xl border pl-9 pr-3.5 text-sm outline-none transition-all focus:ring-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)",
                ["--tw-ring-color" as string]: `${GC.caramel}40` }}
              placeholder={tab === "orders" ? "Buscar por número do pedido..." : "Buscar por número ou cliente..."}
              value={tab === "orders" ? search : pdvSearch}
              onChange={(e) => { tab === "orders" ? (setPage(1), setSearch(e.target.value)) : (setPdvPage(1), setPdvSearch(e.target.value)); }}
            />
          </div>
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            value={tab === "orders" ? status : pdvStatus}
            onChange={(e) => tab === "orders"
              ? (setPage(1), setStatus(e.target.value as OrderStatus | ""))
              : (setPdvPage(1), setPdvStatus(e.target.value))}>
            {(tab === "orders"
              ? STATUS_OPTIONS.filter((o) => ownDelivery || o.value !== "SAIU_PARA_ENTREGA")
              : PDV_STATUS_OPTIONS
            ).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ── Orders tab ── */}
        {tab === "orders" && (
          <>
            {ordersQuery.isError && (
              <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-4">
                Erro ao carregar pedidos.
              </div>
            )}
            <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    {["Pedido", "Cliente", "Status", "Valor", "Data"].map((h, i) => (
                      <th key={h}
                        className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i === 1 ? "hidden sm:table-cell" : i === 3 ? "text-right hidden md:table-cell" : i === 4 ? "text-right hidden lg:table-cell" : ""}`}
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordersQuery.isLoading && <TableSkeleton rows={8} cols={5} />}
                  {!ordersQuery.isLoading && items.length === 0 && (
                    <tr><td colSpan={5}>
                      <EmptyState icon={ShoppingBag} title="Nenhum pedido encontrado"
                        description={search || status ? "Tente ajustar os filtros." : "Os pedidos do catálogo aparecerão aqui."} />
                    </td></tr>
                  )}
                  {items.map((o, i) => (
                    <tr key={o.id} onClick={() => navigate(`/app/pedidos/${o.orderNumber}`)}
                      className="cursor-pointer transition-colors"
                      style={{ backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(200,149,58,0.07)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")}>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold" style={{ color: "var(--text)" }}>{o.orderNumber}</span>
                        {o.isTableOrder && (
                          <div className="text-xs mt-0.5 font-semibold flex items-center gap-1" style={{ color: GC.caramel }}>
                            <Coffee size={11} />Mesa {o.tableNumber ?? "-"}{o.tableName ? ` - ${o.tableName}` : ""}
                          </div>
                        )}
                        <div className="sm:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{o.customerName}</div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell" style={{ color: "var(--text)" }}>{o.customerName}</td>
                      <td className="px-4 py-3.5"><OrderStatusBadge status={o.status as OrderStatus} /></td>
                      <td className="px-4 py-3.5 text-right hidden md:table-cell font-semibold" style={{ color: "var(--text)" }}>{formatBRL(o.totalCents)}</td>
                      <td className="px-4 py-3.5 text-right hidden lg:table-cell text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(o.createdAtUtc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
          </>
        )}

        {/* ── PDV tab ── */}
        {tab === "pdv" && (
          <>
            {pdvQuery.isError && (
              <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-4">
                Erro ao carregar vendas do PDV.
              </div>
            )}
            <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    {["Venda", "Cliente", "Status", "Valor", "Data"].map((h, i) => (
                      <th key={h}
                        className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i === 1 ? "hidden sm:table-cell" : i === 3 ? "text-right hidden md:table-cell" : i === 4 ? "text-right hidden lg:table-cell" : ""}`}
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pdvQuery.isLoading && <TableSkeleton rows={8} cols={5} />}
                  {!pdvQuery.isLoading && pdvItems.length === 0 && (
                    <tr><td colSpan={5}>
                      <EmptyState icon={Monitor} title="Nenhuma venda no PDV"
                        description={pdvSearch || pdvStatus ? "Tente ajustar os filtros." : "As vendas realizadas no Frente de Caixa aparecerão aqui."} />
                    </td></tr>
                  )}
                  {pdvItems.map((o, i) => (
                    <tr key={o.id}
                      className="transition-colors"
                      style={{ backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(200,149,58,0.07)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")}>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold" style={{ color: "var(--text)" }}>{o.publicId}</span>
                        {o.fromDav && (
                          <div className="text-xs mt-0.5 font-semibold" style={{ color: GC.caramel }}>via DAV</div>
                        )}
                        <div className="sm:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{o.customerName || "—"}</div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell" style={{ color: "var(--text)" }}>{o.customerName || "—"}</td>
                      <td className="px-4 py-3.5">{pdvStatusBadge(o.status)}</td>
                      <td className="px-4 py-3.5 text-right hidden md:table-cell font-semibold" style={{ color: "var(--text)" }}>{formatBRL(o.totalCents)}</td>
                      <td className="px-4 py-3.5 text-right hidden lg:table-cell text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(o.createdAtUtc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pdvPage} totalPages={pdvTotalPages} total={pdvTotal}
              onPrev={() => setPdvPage((p) => Math.max(1, p - 1))}
              onNext={() => setPdvPage((p) => Math.min(pdvTotalPages, p + 1))} />
          </>
        )}
      </div>
    </div>
  );
}
