import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchTenantInfo, resolveTenantFromHost } from "@/utils/tenant";
import type { ReactNode } from "react";

interface Props {
  /**
   * Lista de roles permitidos para acessar a rota.
   * Se omitido ou vazio, renderiza sempre (sem restrição).
   */
  roles?: string[];
  featureKey?: string;
  children: ReactNode;
}

/**
 * Protege rotas do /app que exigem perfil específico.
 * Usuário sem role adequada é redirecionado para a Central (/app).
 */
export function ModuleGuard({ roles, featureKey, children }: Props) {
  const { role } = useCurrentUser();
  const tenantSlug = resolveTenantFromHost();
  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenantInfo,
    enabled: !!tenantSlug,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (roles && roles.length > 0) {
    if (role === null || !roles.includes(role)) {
      return <Navigate to="/app" replace />;
    }
  }

  if (featureKey && tenantSlug) {
    if (tenantQuery.isPending) return null;
    const enabled = (tenantQuery.data?.features?.[featureKey] ?? true) === true;
    if (!enabled) return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
