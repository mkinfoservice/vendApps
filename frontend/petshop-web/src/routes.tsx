import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Checkout from "./pages/Checkout";

import OrdersList from "./pages/admin/OrdersList";
import OrderDetail from "./pages/admin/OrderDetail";

import RoutesList from "./pages/admin/RoutesList";
import RouteDetail from "./pages/admin/RouteDetail";

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
          path="/admin/routes/:routeId"
          element={
            <AdminGuard>
              <RouteDetail />
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
