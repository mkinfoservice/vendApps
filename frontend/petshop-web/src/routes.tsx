import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Checkout from "./pages/Checkout";
import ProductDetail from "./pages/ProductDetail";

import Dashboard from "./pages/admin/Dashboard";
import OrdersList from "./pages/admin/OrdersList";
import OrderDetail from "./pages/admin/OrderDetail";
import DelivererForm from "./pages/admin/DelivererForm";
import DeliverersList from "./pages/admin/DeliverersList";

import RoutesList from "./pages/admin/RoutesList";
import RouteDetail from "./pages/admin/RouteDetail";
import Financeiro from "./pages/admin/Financeiro";
import ProductsList from "./pages/admin/ProductsList";
import ProductForm from "./pages/admin/ProductForm";

import AdminLogin from "./pages/admin/Login";
import { AdminGuard } from "@/features/admin/auth/Guard";
import RoutePlanner from "./pages/admin/RoutePlanner";
import StoreTeam from "./pages/admin/StoreTeam";

import CustomersList from "./pages/admin/CustomersList";
import CustomerDetail from "./pages/admin/CustomerDetail";
import CustomerForm from "./pages/admin/CustomerForm";
import AtendimentoHub from "./pages/admin/AtendimentoHub";
import PhoneOrderBuilder from "./pages/admin/PhoneOrderBuilder";

import MasterLogin from "./pages/master/Login";
import MasterCompanies from "./pages/master/Companies";
import MasterCompanyDetail from "./pages/master/CompanyDetail";
import { MasterGuard } from "@/features/master/auth/Guard";

import DelivererLogin from "./pages/deliverer/Login";
import DelivererHome from "./pages/deliverer/Home";
import DelivererRouteDetail from "./pages/deliverer/RouteDetail";
import { DelivererGuard } from "@/features/deliverer/auth/Guard";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Público */}
        <Route path="/" element={<App />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/produto/:id" element={<ProductDetail />} />

        {/* Admin Login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin - Dashboard */}
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <Dashboard />
            </AdminGuard>
          }
        />

        {/* Admin - Pedidos */}
        <Route
          path="/admin/orders"
          element={
            <AdminGuard>
              <OrdersList />
            </AdminGuard>
          }
        />

        <Route
          path="/admin/orders/:id"
          element={
            <AdminGuard>
              <OrderDetail />
            </AdminGuard>
          }
        />
        {/* Admin - Entregadores */}
        <Route
          path="/admin/deliverers"
          element={
            <AdminGuard>
              <DeliverersList />
            </AdminGuard>
          }
          />
        <Route
          path="/admin/deliverers/new"
          element={
            <AdminGuard>
              <DelivererForm />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/deliverers/:id"
          element={
            <AdminGuard>
              <DelivererForm />
            </AdminGuard>
          }
        />
        {/* Admin - Rotas */}
        <Route
          path="/admin/routes"
          element={
            <AdminGuard>
              <RoutesList />
            </AdminGuard>
          }
        />

        <Route
          path="/admin/routes/planner"
          element={
            <AdminGuard>
              <RoutePlanner />
            </AdminGuard>
          }
        />

        <Route
          path="/admin/routes/:routeId"
          element={
            <AdminGuard>
              <RouteDetail />
            </AdminGuard>
          }
        />

        {/* Admin - Financeiro */}
        <Route
          path="/admin/financeiro"
          element={
            <AdminGuard>
              <Financeiro />
            </AdminGuard>
          }
        />

        {/* Admin - Produtos */}
        <Route
          path="/admin/products"
          element={
            <AdminGuard>
              <ProductsList />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/products/:id"
          element={
            <AdminGuard>
              <ProductForm />
            </AdminGuard>
          }
        />

        {/* Admin - Equipe */}
        <Route
          path="/admin/equipe"
          element={
            <AdminGuard>
              <StoreTeam />
            </AdminGuard>
          }
        />

        {/* Admin - Atendimento: Hub */}
        <Route
          path="/admin/atendimento"
          element={
            <AdminGuard>
              <AtendimentoHub />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/atendimento/pedido"
          element={
            <AdminGuard>
              <PhoneOrderBuilder />
            </AdminGuard>
          }
        />

        {/* Admin - Atendimento: Clientes */}
        <Route
          path="/admin/atendimento/clientes"
          element={
            <AdminGuard>
              <CustomersList />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/atendimento/clientes/novo"
          element={
            <AdminGuard>
              <CustomerForm />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/atendimento/clientes/:id"
          element={
            <AdminGuard>
              <CustomerDetail />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/atendimento/clientes/:id/editar"
          element={
            <AdminGuard>
              <CustomerForm />
            </AdminGuard>
          }
        />

        {/* Master Admin */}
        <Route path="/master/login" element={<MasterLogin />} />
        <Route
          path="/master"
          element={
            <MasterGuard>
              <MasterCompanies />
            </MasterGuard>
          }
        />
        <Route
          path="/master/companies/:id"
          element={
            <MasterGuard>
              <MasterCompanyDetail />
            </MasterGuard>
          }
        />

        {/* Entregador */}
        <Route path="/deliverer/login" element={<DelivererLogin />} />
        <Route
          path="/deliverer"
          element={
            <DelivererGuard>
              <DelivererHome />
            </DelivererGuard>
          }
        />
        <Route
          path="/deliverer/route/:routeId"
          element={
            <DelivererGuard>
              <DelivererRouteDetail />
            </DelivererGuard>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
