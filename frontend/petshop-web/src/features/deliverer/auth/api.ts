const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

export type DelivererLoginRequest = { phone: string; pin: string };
export type DelivererLoginResponse = {
  token: string;
  delivererId: string;
  name: string;
};

export async function delivererLogin(
  payload: DelivererLoginRequest
): Promise<DelivererLoginResponse> {
  const res = await fetch(`${API_URL}/auth/deliverer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    let msg = "Credenciais inválidas.";
    try {
      if (ct.includes("application/json")) {
        const data = (await res.json()) as Record<string, unknown>;
        msg = (data?.message as string) ?? msg;
      } else {
        msg = (await res.text()) || msg;
      }
    } catch {
      // ignora
    }
    throw new Error(msg);
  }

  return (await res.json()) as DelivererLoginResponse;
}
