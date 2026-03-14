import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ReactNode } from "react";

interface Props {
  /**
   * Lista de roles permitidos para acessar a rota.
   * Se omitido ou vazio, renderiza sempre (sem restrição).
   */
  roles?: string[];
  children: ReactNode;
}

/**
 * Protege rotas do /app que exigem perfil específico.
 * Usuário sem role adequada é redirecionado para a Central (/app).
 */
export function ModuleGuard({ roles, children }: Props) {
  const { role } = useCurrentUser();

  if (roles && roles.length > 0) {
    if (role === null || !roles.includes(role)) {
      return <Navigate to="/app" replace />;
    }
  }

  return <>{children}</>;
}
