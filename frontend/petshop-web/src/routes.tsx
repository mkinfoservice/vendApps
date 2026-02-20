import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Checkout from "./pages/Checkout";

import Dashboard from "./pages/admin/Dashboard";
import OrdersList from "./pages/admin/OrdersList";
import OrderDetail from "./pages/admin/OrderDetail";

import RoutesList from "./pages/admin/RoutesList";
import RouteDetail from "./pages/admin/RouteDetail";
import Financeiro from "./pages/admin/Financeiro";

import AdminLogin from "./pages/admin/Login";
import { AdminGuard } from "@/features/admin/auth/Guard";
import RoutePlanner from "./pages/admin/RoutePlanner";

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
