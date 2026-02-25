const TOKEN_KEY = "master_admin_token";

export function saveMasterToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getMasterToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearMasterToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isMasterAuthenticated(): boolean {
  return !!getMasterToken();
}
