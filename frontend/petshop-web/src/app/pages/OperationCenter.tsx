import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, Clock, ShoppingBag, ChefHat, Bike, PackageCheck, Users, RefreshCw, Monitor, FileText, Headphones, ArrowRight, Coffee } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  APP_MODULES,
  getModulesByGroup,
  getGroupOrder,
  canAccess,
  type AppModule,
} from "@/config/modules";
import { ModuleCard } from "@/app/components/ModuleCard";
import { ModuleGroupSection } from "@/app/components/ModuleGroupSection";
import { useFavoriteModules } from "@/hooks/useFavoriteModules";
import { useRecentModules } from "@/hooks/useRecentModules";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { resolveTenantFromHost, fetchTenantInfo } from "@/utils/tenant";
import { useDashboard } from "@/features/admin/dashboard/queries";
import type { AdminDashboardResponse } from "@/features/admin/dashboard/api";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// â”€â”€ KPI Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type KpiItem = {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  sub?: string;
  route?: string;
};

function KpiCard({ label, value, icon: Icon, accent, sub, route }: KpiItem) {
  const navigate = useNavigate();
  const clickable = !!route;

  return (
    <div
      onClick={clickable ? () => navigate(route!) : undefined}
      className={[
        "rounded-2xl border p-4 flex flex-col gap-3 transition-all",
        clickable ? "cursor-pointer hover:ring-2 hover:ring-[#C8953A]/25 hover:scale-[1.02] active:scale-[0.99]" : "",
      ].join(" ")}
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}22` }}
        >
          <Icon size={15} color={accent} />
        </div>
      </div>
      <div>
        <span className="text-3xl font-black tabular-nums" style={{ color: "var(--text)" }}>
          {value}
        </span>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
      {clickable && (
        <p className="text-[10px] font-semibold uppercase tracking-widest mt-auto" style={{ color: accent }}>
          Ver detalhes â†’
        </p>
      )}
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3 animate-pulse"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded" style={{ backgroundColor: "var(--surface-2)" }} />
        <div className="w-8 h-8 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }} />
      </div>
      <div className="h-8 w-16 rounded" style={{ backgroundColor: "var(--surface-2)" }} />
    </div>
  );
}

function buildKpis(d: AdminDashboardResponse): KpiItem[] {
  const totalOrders =
    d.orders.recebido +
    d.orders.emPreparo +
    d.orders.prontoParaEntrega +
    d.orders.saiuParaEntrega +
    d.orders.entregue;

  return [
    {
      label: "Pedidos hoje",
      value: totalOrders,
      icon: ShoppingBag,
      accent: "#C8953A",
      sub: `${d.orders.entregue} entregue${d.orders.entregue !== 1 ? "s" : ""}`,
      route: "/app/pedidos",
    },
    {
      label: "Em preparo",
      value: d.orders.emPreparo,
      icon: ChefHat,
      accent: "#A07230",
      sub: `${d.orders.recebido} aguardando`,
      route: "/app/pedidos?status=EM_PREPARO",
    },
    {
      label: "Prontos p/ entrega",
      value: d.orders.prontoParaEntrega,
      icon: PackageCheck,
      accent: "#059669",
      sub: d.readyOrdersWithoutCoords > 0
        ? `${d.readyOrdersWithoutCoords} sem coords`
        : "todos com coords",
      route: "/app/pedidos?status=PRONTO_PARA_ENTREGA",
    },
    {
      label: "Saiu p/ entrega",
      value: d.orders.saiuParaEntrega,
      icon: Bike,
      accent: "#6B4F3A",
      sub: `${d.routes.emAndamento} rota${d.routes.emAndamento !== 1 ? "s" : ""} ativa${d.routes.emAndamento !== 1 ? "s" : ""}`,
      route: "/app/logistica/rotas",
    },
    {
      label: "Entregadores",
      value: d.deliverers.active,
      icon: Users,
      accent: "#C8953A",
      sub: `${d.deliverers.withActiveRoute} em rota`,
      route: "/app/logistica/entregadores",
    },
  ];
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function OperationCenter() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavoriteModules();
  const { track: trackRecent, getRecents } = useRecentModules();

  // Tenant name
  const tenantSlug = resolveTenantFromHost();
  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenantInfo,
    enabled: !!tenantSlug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const companyName = tenantQuery.data?.name ?? "";
  const tenantFeatures = tenantQuery.data?.features ?? null;

  // User info from JWT
  const { role, firstName: jwtFirstName } = useCurrentUser();
  const firstName = jwtFirstName ?? "";

  if (tenantSlug && tenantQuery.isPending) return null;

  // Dashboard KPIs
  const { data: dash, isLoading: dashLoading, dataUpdatedAt, refetch: refetchDash } = useDashboard();
  const kpis = dash ? buildKpis(dash) : null;
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

  // Module data — filtrado por isActive e permissões do role
  const modulesByGroup = getModulesByGroup();
  const groupOrder = getGroupOrder();
  const activeModules = APP_MODULES.filter(
    (m) => m.isActive && canAccess(m, role, tenantFeatures),
  );

  // Search filter
  const searchResults = useMemo<AppModule[] | null>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return activeModules.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }, [search, activeModules]);

  // Recents and favorites lists
  const recentIds = getRecents();
  const recentModules = recentIds
    .map((id) => activeModules.find((m) => m.id === id))
    .filter(Boolean) as AppModule[];

  const favoriteModules = favorites
    .map((id) => activeModules.find((m) => m.id === id))
    .filter(Boolean) as AppModule[];

  function handleNavigate(moduleId: string) {
    trackRecent(moduleId);
  }

  const showAccessHistory =
    searchResults === null &&
    (favoriteModules.length > 0 || recentModules.length > 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-8 space-y-8">

      {/* â”€â”€ Welcome header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="space-y-1">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {getGreeting()}{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {companyName
            ? `${companyName} — Central de Operações`
            : "Central de Operações"}
        </p>
      </div>

      {/* â”€â”€ Search bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          placeholder="Buscar módulo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 rounded-xl border pl-9 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#C8953A]/30"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
      </div>

      {/* â”€â”€ Acesso RÃ¡pido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchResults === null && (
        <section className="space-y-2">
          <h2
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Acesso rápido
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Mesas */}
            <button
              type="button"
              onClick={() => { trackRecent("mesas"); navigate("/app/mesas"); }}
              className="group relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:ring-2 hover:ring-[#C8953A]/40 hover:scale-[1.02] active:scale-[0.99]"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(200,149,58,0.14)" }}>
                <Coffee size={22} color="#C8953A" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>Mesas</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>Auto-atendimento e QR Code</p>
              </div>
              <ArrowRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#C8953A" }} />
            </button>

            {/* Atendimento */}
            <button
              type="button"
              onClick={() => { trackRecent("atendimento"); navigate("/app/atendimento"); }}
              className="group relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:ring-2 hover:ring-[#C8953A]/40 hover:scale-[1.02] active:scale-[0.99]"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(200,149,58,0.14)" }}>
                <Headphones size={22} color="#C8953A" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>Atendimento</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>Pedidos por telefone e balcão</p>
              </div>
              <ArrowRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#C8953A" }} />
            </button>

            {/* Frente de Caixa / PDV */}
            <button
              type="button"
              onClick={() => { trackRecent("pdv"); navigate("/pdv"); }}
              className="group relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:ring-2 hover:ring-[#C8953A]/40 hover:scale-[1.02] active:scale-[0.99]"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(200,149,58,0.14)" }}>
                <Monitor size={22} color="#C8953A" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>Frente de Caixa</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>Registrar vendas no PDV</p>
              </div>
              <ArrowRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#C8953A" }} />
            </button>

            {/* Orçamento / DAV */}
            {(tenantFeatures?.dav_menu ?? true) && (
              <button
                type="button"
                onClick={() => { trackRecent("orcamento"); navigate("/app/dav"); }}
                className="group relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:ring-2 hover:ring-[#A07230]/40 hover:scale-[1.02] active:scale-[0.99]"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(160,114,48,0.14)" }}>
                  <FileText size={22} color="#A07230" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>Orçamento / DAV</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>Montar orçamento para o cliente</p>
                </div>
                <ArrowRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#A07230" }} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchResults === null && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Visão geral de hoje
            </h2>
            <div className="flex items-center gap-2">
              {updatedAt && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Atualizado às {updatedAt}
                </span>
              )}
              <button
                type="button"
                onClick={() => refetchDash()}
                title="Atualizar"
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)]"
                style={{ color: "var(--text-muted)" }}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {dashLoading
              ? Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
              : kpis?.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </section>
      )}

      {/* â”€â”€ Search results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchResults !== null && (
        <section className="space-y-3">
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            {searchResults.length > 0
              ? `${searchResults.length} resultado${searchResults.length > 1 ? "s" : ""}`
              : "Nenhum módulo encontrado"}
          </p>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {searchResults.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  isFavorite={isFavorite(mod.id)}
                  onToggleFavorite={toggleFavorite}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* â”€â”€ Normal layout (no search) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchResults === null && (
        <>
          {/* Favorites */}
          {favoriteModules.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Star size={13} color="#f59e0b" fill="#f59e0b" />
                <h2
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Favoritos
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {favoriteModules.map((mod) => (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recents */}
          {recentModules.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={13} style={{ color: "var(--text-muted)" }} />
                <h2
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Acessados recentemente
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {recentModules.map((mod) => (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    isFavorite={isFavorite(mod.id)}
                    onToggleFavorite={toggleFavorite}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Divider between history and all modules */}
          {showAccessHistory && (
            <div
              className="h-px"
              style={{ backgroundColor: "var(--border)" }}
            />
          )}

          {/* All module groups */}
          {groupOrder.map((group) => {
            const modules = (modulesByGroup[group] ?? []).filter(
              (m) => m.isActive && canAccess(m, role, tenantFeatures),
            );
            return (
              <ModuleGroupSection
                key={group}
                group={group}
                modules={modules}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onNavigate={handleNavigate}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

