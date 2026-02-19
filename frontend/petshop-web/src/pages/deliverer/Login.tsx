import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { delivererLogin } from "@/features/deliverer/auth/api";
import {
  isDelivererAuthenticated,
  saveDelivererToken,
  saveDelivererInfo,
} from "@/features/deliverer/auth/auth";

export default function DelivererLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isDelivererAuthenticated()) {
      navigate("/deliverer", { replace: true });
    }
  }, [navigate]);

  async function handleLogin() {
    if (loading) return;

    const p = phone.trim();
    const pi = pin.trim();

    if (!p || !pi) {
      setError("Informe telefone e PIN.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await delivererLogin({ phone: p, pin: pi });
      saveDelivererToken(res.token);
      saveDelivererInfo({ id: res.delivererId, name: res.name });

      navigate("/deliverer", { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao entrar.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-2xl font-extrabold">Portal do Entregador</div>
          <div className="text-sm text-zinc-400 mt-1">
            Entre com telefone e PIN
          </div>
        </div>

        <input
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-base"
          placeholder="Telefone (21) 99999-9999"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        <input
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-center text-2xl tracking-[0.5em] font-mono"
          placeholder="PIN"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoComplete="current-password"
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setPin(v);
          }}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        {error && <div className="text-sm text-red-400 text-center">{error}</div>}

        <button
          className="h-12 w-full rounded-xl bg-white text-black font-bold text-base disabled:opacity-50"
          disabled={loading || !phone.trim() || pin.length < 4}
          onClick={handleLogin}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
