const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const r = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || "Credenciais inválidas.");
  }

  return r.json();
}
