const TOKEN_KEY = "petshop_admin_token";

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export type TokenPayload = {
  sub?: string;
  role?: string;
  companyId?: string;
  boundSlug?: string;
  exp?: number;
};

/** Roles com permissão de acesso ao financeiro */
export const FINANCE_ROLES = ["admin", "gerente"] as const;

/** Roles com permissão de gerenciar equipe */
export const TEAM_ROLES = ["admin", "gerente"] as const;

export function getRole(): string | null {
  const token = localStorage.getItem("petshop_admin_token");
  return decodeTokenPayload(token)?.role ?? null;
}

export function hasRole(...roles: string[]): boolean {
  const role = getRole();
  return role !== null && roles.includes(role);
}

/**
 * Decodifica o payload do JWT sem validar assinatura.
 * Usado apenas para leitura de claims no frontend (companyId, boundSlug).
 */
export function decodeTokenPayload(token: string | null): TokenPayload | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 padrão
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)) as TokenPayload;
  } catch {
    return null;
  }
}
