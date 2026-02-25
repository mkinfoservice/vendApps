import { Navigate } from "react-router-dom";
import { isMasterAuthenticated } from "./auth";
import type { ReactNode } from "react";

export function MasterGuard({ children }: { children: ReactNode }) {
  if (!isMasterAuthenticated()) {
    return <Navigate to="/master/login" replace />;
  }
  return <>{children}</>;
}
