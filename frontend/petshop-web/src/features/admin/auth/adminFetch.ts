import { getToken, clearToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

type AdminFetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export async function adminFetch<T = unknown>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Se perder a sessão, limpa e força login
  if (res.status === 401) {
    clearToken();
    window.location.href = "/admin/login";
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // Erro HTTP -> tenta ler texto/JSON para mensagem
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    let msg = `Erro HTTP ${res.status}`;

    try {
      if (ct.includes("application/json")) {
        const data = (await res.json()) as any;
        msg = data?.message ?? JSON.stringify(data);
      } else {
        msg = await res.text();
      }
    } catch {
      // ignora
    }

    throw new Error(msg || `Erro HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  // Se não for JSON, devolve texto
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}
