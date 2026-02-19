import { Navigate } from "react-router-dom";
import { isAuthenticated } from "./auth";
import type { ReactNode } from "react";

export function AdminGuard({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
