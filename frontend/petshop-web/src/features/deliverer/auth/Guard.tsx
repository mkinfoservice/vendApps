import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isDelivererAuthenticated } from "./auth";

export function DelivererGuard({ children }: { children: ReactNode }) {
  if (!isDelivererAuthenticated()) {
    return <Navigate to="/deliverer/login" replace />;
  }
  return <>{children}</>;
}
