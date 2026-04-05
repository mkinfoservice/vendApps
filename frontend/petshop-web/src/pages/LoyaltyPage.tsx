import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Gift, Loader2, ShieldCheck, Sparkles, Star } from "lucide-react";
import {
  createLoyaltySession,
  detectLoyaltySlug,
  getLoyaltyDashboard,
  redeemLoyaltyReward,
  type LoyaltyReward,
} from "@/features/loyalty/publicApi";

const SESSION_KEY = "vendapps_loyalty_session";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RedeemModal({
  reward,
  onClose,
  onConfirm,
  pending,
}: {
  reward: LoyaltyReward;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-5 shadow-2xl border-violet-100">
        <p className="text-xs uppercase tracking-[0.18em] text-violet-500 font-semibold">Confirmar Resgate</p>
        <h3 className="text-xl font-black text-slate-900 mt-1">{reward.name}</h3>
        <p className="text-sm text-slate-600 mt-1">{reward.description ?? "Cupom de benefício para seu próximo pedido."}</p>
        <div className="mt-4 rounded-2xl p-3 bg-violet-50 border border-violet-100">
          <p className="text-sm font-semibold text-violet-700">
            Custo: {reward.pointsCost.toLocaleString("pt-BR")} pontos
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            className="flex-1 h-11 rounded-xl bg-[#7c5cf8] text-white font-semibold disabled:opacity-50"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Resgatando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const slug = useMemo(() => detectLoyaltySlug(searchParams.get("slug")), [searchParams]);

  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? "");
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const sessionMut = useMutation({
    mutationFn: () => createLoyaltySession(phone, cpf, slug),
    onSuccess: (res) => {
      setAuthError(null);
      setSessionToken(res.sessionToken);
      sessionStorage.setItem(SESSION_KEY, res.sessionToken);
    },
    onError: (e: Error) => setAuthError(e.message),
  });

  const dashboardQuery = useQuery({
    queryKey: ["public-loyalty-dashboard", sessionToken],
    queryFn: () => getLoyaltyDashboard(sessionToken),
    enabled: !!sessionToken,
    retry: false,
  });

  const redeemMut = useMutation({
    mutationFn: (promotionId: string) =>
      redeemLoyaltyReward(
        sessionToken,
        promotionId,
        crypto.randomUUID(),
      ),
    onSuccess: (res) => {
      setSelectedReward(null);
      setRedeemSuccess(`Resgate confirmado! Cupom: ${res.couponCode}`);
      qc.invalidateQueries({ queryKey: ["public-loyalty-dashboard", sessionToken] });
    },
  });

  const logout = () => {
    setSessionToken("");
    setAuthError(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ede9fe,transparent_45%),linear-gradient(180deg,#faf5ff,#f8fafc)] px-4 py-10">
        <div className="max-w-md mx-auto">
          <div className="rounded-[28px] border border-violet-100 bg-white/90 backdrop-blur p-6 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-4">
              <Star className="w-6 h-6 fill-current" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Sua Fidelidade</h1>
            <p className="text-sm text-slate-600 mt-1">
              Consulte seus pontos e troque por benefícios exclusivos.
            </p>

            <div className="mt-5 space-y-3">
              <input
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                placeholder="Telefone"
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <input
                value={cpf}
                onChange={e => setCpf(maskCpf(e.target.value))}
                placeholder="CPF"
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <button
                onClick={() => sessionMut.mutate()}
                disabled={sessionMut.isPending}
                className="w-full h-11 rounded-xl bg-[#7c5cf8] text-white font-semibold disabled:opacity-50"
              >
                {sessionMut.isPending ? "Entrando..." : "Consultar meus pontos"}
              </button>
            </div>
            {authError && <p className="text-sm text-rose-600 mt-3">{authError}</p>}
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4" />
              Sessão protegida e com tempo limitado.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-700">Sua sessão expirou ou não pôde ser validada.</p>
          <button className="mt-4 h-10 w-full rounded-xl bg-[#7c5cf8] text-white font-semibold" onClick={logout}>
            Entrar novamente
          </button>
        </div>
      </div>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ede9fe,transparent_40%),#f8fafc]">
      {selectedReward && (
        <RedeemModal
          reward={selectedReward}
          onClose={() => setSelectedReward(null)}
          onConfirm={() => redeemMut.mutate(selectedReward.id)}
          pending={redeemMut.isPending}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="rounded-[28px] bg-gradient-to-br from-[#7c5cf8] to-[#5f45d9] text-white p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.22em] text-white/80">Programa de Fidelidade</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/80">Olá, {data.customer.name.split(" ")[0]}</p>
              <p className="text-4xl font-black leading-none mt-1">
                {data.customer.pointsBalance.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-white/90 mt-1">pontos disponíveis</p>
            </div>
            <Sparkles className="w-8 h-8 text-white/80" />
          </div>
        </div>

        {redeemSuccess && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-semibold">
            {redeemSuccess}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-[0.14em]">Benefícios</h2>
            <Gift className="w-4 h-4 text-violet-500" />
          </div>
          {data.rewards.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Nenhum benefício disponível agora.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.rewards.map((reward) => {
                const disabled = !reward.isAvailable;
                return (
                  <div key={reward.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="h-28 bg-gradient-to-br from-violet-100 to-indigo-100">
                      {reward.imageUrl && (
                        <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="font-bold text-slate-900">{reward.name}</p>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {reward.description ?? "Resgate seu benefício com seus pontos atuais."}
                      </p>
                      <p className="text-sm font-semibold text-violet-600">
                        {reward.pointsCost.toLocaleString("pt-BR")} pontos
                      </p>
                      <button
                        className="w-full h-10 rounded-xl bg-[#7c5cf8] text-white font-semibold disabled:opacity-50"
                        disabled={disabled || redeemMut.isPending}
                        onClick={() => setSelectedReward(reward)}
                      >
                        {reward.isRedeemed ? "Resgatar novamente" : disabled ? "Saldo insuficiente" : "Resgatar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-[0.14em]">Histórico</h2>
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {data.transactions.length === 0 && (
              <p className="p-5 text-sm text-slate-500">Nenhuma movimentação ainda.</p>
            )}
            {data.transactions.map(tx => (
              <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 truncate">{tx.description}</p>
                  <p className="text-xs text-slate-500">{formatDate(tx.createdAtUtc)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${tx.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {tx.points >= 0 ? "+" : ""}{tx.points.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-slate-500">saldo: {tx.balanceAfter.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <button
          onClick={logout}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          Sair da sessão
        </button>
      </div>
    </div>
  );
}
