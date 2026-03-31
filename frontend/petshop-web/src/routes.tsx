import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Checkout from "./pages/Checkout";
import ProductDetail from "./pages/ProductDetail";

// ── Auth ──────────────────────────────────────────────────────────────────────
import LoginPage from "./pages/Login";
import { AdminGuard } from "@/features/admin/auth/Guard";
import { MasterGuard } from "@/features/master/auth/Guard";
import { DelivererGuard } from "@/features/deliverer/auth/Guard";

// ── App shell + Central ───────────────────────────────────────────────────────
import { AppShell } from "@/app/layout/AppShell";
import OperationCenter from "@/app/pages/OperationCenter";
import { ModuleGuard } from "@/app/components/ModuleGuard";

// ── Páginas admin ─────────────────────────────────────────────────────────────
import Dashboard from "./pages/admin/Dashboard";
import OrdersList from "./pages/admin/OrdersList";
import OrderDetail from "./pages/admin/OrderDetail";
import ProductsList from "./pages/admin/ProductsList";
import ProductForm from "./pages/admin/ProductForm";
import DeliverersList from "./pages/admin/DeliverersList";
import DelivererForm from "./pages/admin/DelivererForm";
import RoutesList from "./pages/admin/RoutesList";
import RouteDetail from "./pages/admin/RouteDetail";
import RoutePlanner from "./pages/admin/RoutePlanner";
import Financeiro from "./pages/admin/Financeiro";
import StoreTeam from "./pages/admin/StoreTeam";
import PrintQueue from "./pages/admin/PrintQueue";
import AtendimentoHub from "./pages/admin/AtendimentoHub";
import PhoneOrderBuilder from "./pages/admin/PhoneOrderBuilder";
import CustomersList from "./pages/admin/CustomersList";
import CustomerDetail from "./pages/admin/CustomerDetail";
import CustomerForm from "./pages/admin/CustomerForm";
import CustomersPage from "./pages/admin/CustomersPage";
import LoyaltyConfigPage from "./pages/admin/LoyaltyConfigPage";
import PromotionsPage from "./pages/admin/PromotionsPage";
import SuppliersPage from "./pages/admin/SuppliersPage";
import SuppliesPage from "./pages/admin/SuppliesPage";
import PurchasesPage from "./pages/admin/PurchasesPage";
import PurchaseOrderDetail from "./pages/admin/PurchaseOrderDetail";
import ReportsPage from "./pages/admin/ReportsPage";
import StockPage from "./pages/admin/StockPage";
import FiscalConfigPage from "./pages/admin/FiscalConfigPage";
import FinancialEntriesPage from "./pages/admin/FinancialEntriesPage";
import CashRegistersPage from "./pages/admin/CashRegistersPage";
import CashSessionsPage from "./pages/admin/CashSessionsPage";
import AgendaPage from "./pages/admin/AgendaPage";
import ScaleAgentsPage from "./pages/admin/ScaleAgentsPage";
import DavListPage from "./pages/admin/DavListPage";
import DavBuilderPage from "./pages/admin/DavBuilderPage";
import CatalogEnrichmentPage from "./pages/admin/CatalogEnrichmentPage";
import StoreFrontConfigPage from "./pages/admin/StoreFrontConfigPage";
import TablesPage from "./pages/admin/TablesPage";

// ── PDV ───────────────────────────────────────────────────────────────────────
import PdvPage from "./pages/pdv/PdvPage";
import { PdvProvider } from "@/features/pdv/PdvContext";

// ── Master ────────────────────────────────────────────────────────────────────
import MasterLogin from "./pages/master/Login";
import MasterCompanies from "./pages/master/Companies";
import MasterCompanyDetail from "./pages/master/CompanyDetail";
import MasterPlatformWhatsapp from "./pages/master/PlatformWhatsapp";

// ── Entregador ────────────────────────────────────────────────────────────────
import DelivererLogin from "./pages/deliverer/Login";
import DelivererHome from "./pages/deliverer/Home";
import DelivererRouteDetail from "./pages/deliverer/RouteDetail";

// ── Helper: wraps a page dentro do AppShell + AdminGuard ─────────────────────
function AppPage({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  return (
    <AdminGuard>
      <AppShell>
        <ModuleGuard roles={roles}>{children}</ModuleGuard>
      </AppShell>
    </AdminGuard>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Público ─────────────────────────────────────────────────── */}
        <Route path="/" element={<App />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/produto/:id" element={<ProductDetail />} />

        {/* ── Login unificado ─────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />

        {/* ── Central de Operações ────────────────────────────────────── */}
        <Route path="/app" element={<AppPage><OperationCenter /></AppPage>} />

        {/* ── /app — Operação ─────────────────────────────────────────── */}
        <Route path="/app/mesas" element={<AppPage><TablesPage /></AppPage>} />
        <Route path="/app/pedidos" element={<AppPage><OrdersList /></AppPage>} />
        <Route path="/app/pedidos/:id" element={<AppPage><OrderDetail /></AppPage>} />

        <Route path="/app/atendimento" element={<AppPage><AtendimentoHub /></AppPage>} />
        <Route path="/app/atendimento/pedido" element={<AppPage><PhoneOrderBuilder /></AppPage>} />
        <Route path="/app/atendimento/clientes" element={<AppPage><CustomersList /></AppPage>} />
        <Route path="/app/atendimento/clientes/novo" element={<AppPage><CustomerForm /></AppPage>} />
        <Route path="/app/atendimento/clientes/:id" element={<AppPage><CustomerDetail /></AppPage>} />
        <Route path="/app/atendimento/clientes/:id/editar" element={<AppPage><CustomerForm /></AppPage>} />

        <Route path="/app/dav" element={<AppPage><DavListPage /></AppPage>} />
        <Route path="/app/dav/novo" element={<AppPage><DavBuilderPage /></AppPage>} />

        <Route path="/app/agenda" element={<AppPage><AgendaPage /></AppPage>} />
        <Route path="/app/impressao" element={<AppPage><PrintQueue /></AppPage>} />

        {/* ── /app — Comercial ────────────────────────────────────────── */}
        <Route path="/app/produtos" element={<AppPage><ProductsList /></AppPage>} />
        <Route path="/app/produtos/:id" element={<AppPage><ProductForm /></AppPage>} />

        <Route path="/app/clientes" element={<AppPage><CustomersPage /></AppPage>} />
        <Route path="/app/fidelidade" element={<AppPage roles={["admin","gerente"]}><LoyaltyConfigPage /></AppPage>} />
        <Route path="/app/promocoes" element={<AppPage roles={["admin","gerente"]}><PromotionsPage /></AppPage>} />

        {/* ── /app — Logística ────────────────────────────────────────── */}
        <Route path="/app/logistica/rotas" element={<AppPage><RoutesList /></AppPage>} />
        <Route path="/app/logistica/rotas/planner" element={<AppPage><RoutePlanner /></AppPage>} />
        <Route path="/app/logistica/rotas/:routeId" element={<AppPage><RouteDetail /></AppPage>} />
        <Route path="/app/logistica/entregadores" element={<AppPage roles={["admin","gerente"]}><DeliverersList /></AppPage>} />
        <Route path="/app/logistica/entregadores/novo" element={<AppPage roles={["admin","gerente"]}><DelivererForm /></AppPage>} />
        <Route path="/app/logistica/entregadores/:id" element={<AppPage roles={["admin","gerente"]}><DelivererForm /></AppPage>} />

        <Route path="/app/compras" element={<AppPage roles={["admin","gerente"]}><PurchasesPage /></AppPage>} />
        <Route path="/app/compras/:id" element={<AppPage roles={["admin","gerente"]}><PurchaseOrderDetail /></AppPage>} />
        <Route path="/app/fornecedores" element={<AppPage roles={["admin","gerente"]}><SuppliersPage /></AppPage>} />
        <Route path="/app/insumos" element={<AppPage roles={["admin","gerente"]}><SuppliesPage /></AppPage>} />

        {/* ── /app — Gestão ───────────────────────────────────────────── */}
        <Route path="/app/financeiro" element={<AppPage roles={["admin","gerente"]}><Financeiro /></AppPage>} />
        <Route path="/app/financeiro/lancamentos" element={<AppPage roles={["admin","gerente"]}><FinancialEntriesPage /></AppPage>} />

        <Route path="/app/caixa" element={<AppPage><CashRegistersPage /></AppPage>} />
        <Route path="/app/caixa/sessoes" element={<AppPage><CashSessionsPage /></AppPage>} />

        <Route path="/app/estoque" element={<AppPage roles={["admin","gerente"]}><StockPage /></AppPage>} />
        <Route path="/app/relatorios" element={<AppPage roles={["admin","gerente"]}><ReportsPage /></AppPage>} />

        {/* ── /app — Plataforma ───────────────────────────────────────── */}
        <Route path="/app/equipe" element={<AppPage roles={["admin"]}><StoreTeam /></AppPage>} />
        <Route path="/app/fiscal" element={<AppPage roles={["admin"]}><FiscalConfigPage /></AppPage>} />
        <Route path="/app/balanca" element={<AppPage roles={["admin"]}><ScaleAgentsPage /></AppPage>} />
        <Route path="/app/enriquecimento" element={<AppPage roles={["admin","gerente"]}><CatalogEnrichmentPage /></AppPage>} />
        <Route path="/app/configuracao-loja" element={<AppPage roles={["admin","gerente"]}><StoreFrontConfigPage /></AppPage>} />
        <Route path="/app/dashboard" element={<AppPage><Dashboard /></AppPage>} />

        {/* ── Redirects legados /admin/* → /app/* ─────────────────────── */}
        <Route path="/admin" element={<Navigate to="/app" replace />} />
        <Route path="/admin/orders" element={<Navigate to="/app/pedidos" replace />} />
        <Route path="/admin/atendimento" element={<Navigate to="/app/atendimento" replace />} />
        <Route path="/admin/atendimento/pedido" element={<Navigate to="/app/atendimento/pedido" replace />} />
        <Route path="/admin/atendimento/clientes" element={<Navigate to="/app/atendimento/clientes" replace />} />
        <Route path="/admin/products" element={<Navigate to="/app/produtos" replace />} />
        <Route path="/admin/customers" element={<Navigate to="/app/clientes" replace />} />
        <Route path="/admin/loyalty" element={<Navigate to="/app/fidelidade" replace />} />
        <Route path="/admin/promotions" element={<Navigate to="/app/promocoes" replace />} />
        <Route path="/admin/routes" element={<Navigate to="/app/logistica/rotas" replace />} />
        <Route path="/admin/routes/planner" element={<Navigate to="/app/logistica/rotas/planner" replace />} />
        <Route path="/admin/deliverers" element={<Navigate to="/app/logistica/entregadores" replace />} />
        <Route path="/admin/deliverers/new" element={<Navigate to="/app/logistica/entregadores/novo" replace />} />
        <Route path="/admin/purchases" element={<Navigate to="/app/compras" replace />} />
        <Route path="/admin/suppliers" element={<Navigate to="/app/fornecedores" replace />} />
        <Route path="/admin/supplies" element={<Navigate to="/app/insumos" replace />} />
        <Route path="/admin/financeiro" element={<Navigate to="/app/financeiro" replace />} />
        <Route path="/admin/financial" element={<Navigate to="/app/financeiro/lancamentos" replace />} />
        <Route path="/admin/pdv/terminais" element={<Navigate to="/app/caixa" replace />} />
        <Route path="/admin/pdv/sessoes" element={<Navigate to="/app/caixa/sessoes" replace />} />
        <Route path="/admin/stock" element={<Navigate to="/app/estoque" replace />} />
        <Route path="/admin/reports" element={<Navigate to="/app/relatorios" replace />} />
        <Route path="/admin/equipe" element={<Navigate to="/app/equipe" replace />} />
        <Route path="/admin/fiscal" element={<Navigate to="/app/fiscal" replace />} />
        <Route path="/admin/scale" element={<Navigate to="/app/balanca" replace />} />
        <Route path="/admin/print" element={<Navigate to="/app/impressao" replace />} />
        <Route path="/admin/agenda" element={<Navigate to="/app/agenda" replace />} />

        {/* ── PDV — tela cheia, fora do AppShell ──────────────────────── */}
        <Route
          path="/pdv"
          element={
            <AdminGuard>
              <PdvProvider>
                <PdvPage />
              </PdvProvider>
            </AdminGuard>
          }
        />

        {/* ── Master ──────────────────────────────────────────────────── */}
        <Route path="/master/login" element={<MasterLogin />} />
        <Route path="/master" element={<MasterGuard><MasterCompanies /></MasterGuard>} />
        <Route path="/master/companies/:id" element={<MasterGuard><MasterCompanyDetail /></MasterGuard>} />
        <Route path="/master/platform/whatsapp" element={<MasterGuard><MasterPlatformWhatsapp /></MasterGuard>} />

        {/* ── Entregador ──────────────────────────────────────────────── */}
        <Route path="/deliverer/login" element={<DelivererLogin />} />
        <Route path="/deliverer" element={<DelivererGuard><DelivererHome /></DelivererGuard>} />
        <Route path="/deliverer/route/:routeId" element={<DelivererGuard><DelivererRouteDetail /></DelivererGuard>} />

      </Routes>
    </BrowserRouter>
  );
}
