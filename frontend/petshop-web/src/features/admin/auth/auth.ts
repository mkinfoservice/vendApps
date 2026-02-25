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
  companyId?: string;
  boundSlug?: string;
  exp?: number;
};

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
