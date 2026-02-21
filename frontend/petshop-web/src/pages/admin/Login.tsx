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

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      navigate("/admin", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Card header */}
        <div className="px-8 pt-8 pb-6 flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_28px_rgba(124,92,248,0.5)]"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <span className="text-white text-2xl select-none" aria-hidden="true">
              🐾
            </span>
          </div>
          <div className="text-center">
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              vendApps Admin
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Painel Administrativo
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mx-6" style={{ backgroundColor: "var(--border)" }} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pt-6 pb-8 space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Usuário
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              disabled={loading}
              className="w-full h-11 rounded-xl border px-3.5 text-sm outline-none transition-all placeholder:opacity-40 focus:ring-2 focus:ring-[#7c5cf8]/40 disabled:opacity-60"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full h-11 rounded-xl border px-3.5 text-sm outline-none transition-all placeholder:opacity-40 focus:ring-2 focus:ring-[#7c5cf8]/40 disabled:opacity-60"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-800 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full h-11 rounded-xl text-sm font-bold text-white transition-all outline-none focus:ring-2 focus:ring-[#7c5cf8]/50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)",
            }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
