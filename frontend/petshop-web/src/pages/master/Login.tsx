import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { masterLogin } from "@/features/master/auth/api";
import { saveMasterToken } from "@/features/master/auth/auth";

export default function MasterLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await masterLogin({ username, password });
      saveMasterToken(res.token);
      navigate("/master", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Master Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Acesso restrito a administradores globais</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] transition"
              placeholder="masteradmin"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] focus:border-[#7c5cf8] transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl font-black text-sm text-white transition hover:brightness-110 active:scale-95 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            {loading ? "Autenticando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
