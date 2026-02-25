import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAuthenticated, getToken, clearToken, decodeTokenPayload } from "./auth";
import { resolveTenantFromHost, fetchTenantInfo } from "@/utils/tenant";
import type { ReactNode } from "react";

export function AdminGuard({ children }: { children: ReactNode }) {
  const tenantSlug = resolveTenantFromHost();

  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenantInfo,
    enabled: !!tenantSlug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // 1. Não autenticado → login
  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }

  // 2. Em subdomínio: valida que o JWT pertence a esta empresa
  if (tenantSlug) {
    // Aguarda resolução do tenant antes de liberar o painel
    if (tenantQuery.isPending) return null;

    // Tenant não encontrado ou suspenso → limpa sessão e redireciona
    if (tenantQuery.isError) {
      clearToken();
      return <Navigate to="/admin/login" replace />;
    }

    // Compara companyId do JWT com o da empresa do subdomínio
    const payload = decodeTokenPayload(getToken());
    if (
      !payload?.companyId ||
      payload.companyId.toLowerCase() !== tenantQuery.data.companyId.toLowerCase()
    ) {
      clearToken();
      return <Navigate to="/admin/login" replace />;
    }
  }

  return <>{children}</>;
}
