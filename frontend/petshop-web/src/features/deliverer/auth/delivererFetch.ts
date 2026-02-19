import { getDelivererToken, clearDelivererToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

type FetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export async function delivererFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = getDelivererToken();

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearDelivererToken();
    window.location.href = "/deliverer/login";
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    let msg = `Erro HTTP ${res.status}`;
    try {
      if (ct.includes("application/json")) {
        const data = (await res.json()) as Record<string, unknown>;
        msg = (data?.message as string) ?? JSON.stringify(data);
      } else {
        msg = await res.text();
      }
    } catch {
      // ignora
    }
    throw new Error(msg || `Erro HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}
