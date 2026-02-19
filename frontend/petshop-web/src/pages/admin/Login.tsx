import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/admin/auth/api";
import { isAuthenticated, saveToken } from "@/features/admin/auth/auth";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se já estiver logado, não faz sentido ficar no login
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin/orders", { replace: true });
    }
  }, [navigate]);

  async function handleLogin() {
    if (loading) return;

    const u = username.trim();
    const p = password;

    if (!u || !p) {
      setError("Informe usuário e senha.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await login({ username: u, password: p });
      saveToken(res.token);

      // replace evita voltar ao login no botão "voltar"
      navigate("/admin/orders", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <div className="text-lg font-extrabold">Login Admin</div>
          <div className="text-sm text-zinc-300">Acesso restrito</div>
        </div>

        <input
          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm"
          placeholder="Usuário"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        <input
          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm"
          placeholder="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        {error && <div className="text-xs text-red-300">{error}</div>}

        <button
          className="h-11 w-full rounded-xl bg-white text-black font-bold disabled:opacity-50"
          disabled={loading || !username.trim() || !password}
          onClick={handleLogin}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
