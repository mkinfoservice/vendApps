const TOKEN_KEY = "petshop_deliverer_token";
const INFO_KEY = "petshop_deliverer_info";

export function saveDelivererToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getDelivererToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearDelivererToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(INFO_KEY);
}

export function isDelivererAuthenticated(): boolean {
  return !!getDelivererToken();
}

export function saveDelivererInfo(info: { id: string; name: string }) {
  localStorage.setItem(INFO_KEY, JSON.stringify(info));
}

export function getDelivererInfo(): { id: string; name: string } | null {
  const raw = localStorage.getItem(INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
