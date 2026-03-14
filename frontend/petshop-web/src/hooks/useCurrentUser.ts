import { useMemo } from "react";
import { decodeTokenPayload, getToken } from "@/features/admin/auth/auth";

export interface CurrentUser {
  sub: string | null;
  role: string | null;
  companyId: string | null;
  /** Primeiro segmento do sub (antes de espaço, ponto, underscore ou @) */
  firstName: string | null;
}

function extractFirstName(raw: string): string {
  return raw.split(/[\s._@]/)[0] ?? raw;
}

/**
 * Retorna as claims do JWT do admin logado.
 * Leitura síncrona do localStorage — não há estado reativo.
 * O token não muda durante a sessão (AdminGuard garante autenticação).
 */
export function useCurrentUser(): CurrentUser {
  return useMemo(() => {
    const payload = decodeTokenPayload(getToken());
    const sub = payload?.sub ?? null;
    return {
      sub,
      role: payload?.role ?? null,
      companyId: payload?.companyId ?? null,
      firstName: sub ? extractFirstName(sub) : null,
    };
  }, []);
}
