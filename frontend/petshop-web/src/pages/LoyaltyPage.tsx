import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Gift, Loader2, LogOut, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import {
  createLoyaltySession,
  detectLoyaltySlug,
  getLoyaltyDashboard,
  redeemLoyaltyReward,
  type LoyaltyReward,
} from "@/features/loyalty/publicApi";

const SESSION_KEY = "vendapps_loyalty_session";

const THEME = {
  bg: "#f6f1e8",
  card: "#fffdfa",
  brown: "#2d1a0f",
  caramel: "#bf8a3a",
  green: "#127a4d",
  border: "#eadfce",
};

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
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function discountLabel(reward: LoyaltyReward) {
  if (reward.discount.type === "PercentDiscount") return `${reward.discount.value}% OFF`;
  return `${brl(Math.round(reward.discount.value))} OFF`;
}

function sanitizeTxDescription(description: string) {
  return description
    .replace(/cupom\s+[A-Z0-9_-]+/gi, "cupom resgatado")
    .replace(/\[[A-Fa-f0-9-]{36}\]/g, "[beneficio]");
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[28px] p-5 border shadow-2xl" style={{ background: THEME.card, borderColor: THEME.border }}>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: THEME.caramel }}>Confirmar resgate</p>
        <h3 className="text-2xl font-black mt-1" style={{ color: THEME.brown }}>{reward.name}</h3>
        <p className="text-sm mt-2" style={{ color: "#7b6249" }}>
          {reward.description ?? "Beneficio disponivel no seu programa de pontos."}
        </p>
        <div className="mt-4 rounded-2xl p-3" style={{ background: "#f9f1e5", border: `1px solid ${THEME.border}` }}>
          <p className="text-sm font-bold" style={{ color: THEME.brown }}>Custo: {reward.pointsCost.toLocaleString("pt-BR")} pontos</p>
          {reward.couponCode ? (
            <p className="text-xs mt-1" style={{ color: "#7b6249" }}>Codigo liberado somente apos confirmar o resgate.</p>
          ) : (
            <p className="text-xs mt-1" style={{ color: "#7b6249" }}>Resgate sem cupom automatico: atendimento no caixa.</p>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="h-11 rounded-xl border text-sm font-semibold"
            style={{ borderColor: THEME.border, color: THEME.brown }}
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${THEME.caramel}, #9e6d2d)` }}
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
  const [redeemSuccess, setRedeemSuccess] = useState<{ message: string; couponCode: string | null } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

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
    mutationFn: (promotionId: string) => redeemLoyaltyReward(sessionToken, promotionId, crypto.randomUUID()),
    onSuccess: (res) => {
      setSelectedReward(null);
      setCodeCopied(false);
      setRedeemSuccess({
        message: res.couponCode ? "Resgate concluido! Use o código abaixo no checkout." : "Resgate concluido! Apresente ao atendente no caixa.",
        couponCode: res.couponCode ?? null,
      });
      qc.invalidateQueries({ queryKey: ["public-loyalty-dashboard", sessionToken] });
    },
  });

  const logout = () => {
    setSessionToken("");
    setAuthError(null);
    setRedeemSuccess(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  if (!sessionToken) {
    return (
      <div className="min-h-screen px-4 py-8" style={{ background: THEME.bg }}>
        <div className="max-w-md mx-auto rounded-[28px] border p-6 shadow-xl" style={{ background: THEME.card, borderColor: THEME.border }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#f5e6cf", color: THEME.caramel }}>
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black mt-4" style={{ color: THEME.brown }}>Programa de Fidelidade</h1>
          <p className="text-sm mt-2" style={{ color: "#7b6249" }}>
            Entre com telefone e CPF para consultar seus pontos e resgatar beneficios.
          </p>

          <div className="mt-6 space-y-3">
            <input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="Telefone"
              className="w-full h-11 rounded-xl px-3 text-sm outline-none"
              style={{ border: `1px solid ${THEME.border}`, background: "#fff" }}
            />
            <input
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="CPF"
              className="w-full h-11 rounded-xl px-3 text-sm outline-none"
              style={{ border: `1px solid ${THEME.border}`, background: "#fff" }}
            />
            <button
              onClick={() => sessionMut.mutate()}
              disabled={sessionMut.isPending}
              className="w-full h-11 rounded-xl text-white font-bold disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${THEME.brown}, #4a2a17)` }}
            >
              {sessionMut.isPending ? "Entrando..." : "Consultar meus pontos"}
            </button>
          </div>

          {authError && <p className="text-sm mt-3 text-red-600">{authError}</p>}
          <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "#8a735d" }}>
            <ShieldCheck className="w-4 h-4" />
            Sessao protegida e com tempo limitado.
          </div>
        </div>
      </div>
    );
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: THEME.bg }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: THEME.caramel }} />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: THEME.bg }}>
        <div className="max-w-sm w-full rounded-2xl border p-5 text-center" style={{ background: THEME.card, borderColor: THEME.border }}>
          <p className="text-sm" style={{ color: THEME.brown }}>Sua sessao expirou ou nao pode ser validada.</p>
          <button
            className="mt-4 h-10 w-full rounded-xl text-white font-semibold"
            style={{ background: `linear-gradient(135deg, ${THEME.brown}, #4a2a17)` }}
            onClick={logout}
          >
            Entrar novamente
          </button>
        </div>
      </div>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div className="min-h-screen" style={{ background: THEME.bg }}>
      {selectedReward && (
        <RedeemModal
          reward={selectedReward}
          onClose={() => setSelectedReward(null)}
          onConfirm={() => redeemMut.mutate(selectedReward.id)}
          pending={redeemMut.isPending}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-[30px] p-6 md:p-8 border shadow-xl" style={{ borderColor: THEME.border, background: `linear-gradient(135deg, #2d1a0f, #5d3319)` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#f3dcc0]">{data.company.companyName}</p>
              <p className="text-[#f4e8da] mt-2 text-sm">Ola, {data.customer.name.split(" ")[0]}</p>
              <p className="text-5xl md:text-6xl font-black leading-none mt-1 text-white">{data.customer.pointsBalance.toLocaleString("pt-BR")}</p>
              <p className="text-[#f4d7b4] text-sm mt-1">pontos disponiveis</p>
            </div>
            <div className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
              <Sparkles className="w-6 h-6 text-[#f7d3a0]" />
            </div>
          </div>
        </section>

        {redeemSuccess && (
          <div className="rounded-2xl border px-4 py-3 space-y-3" style={{ background: "#effaf4", borderColor: "#b8e8cc" }}>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: THEME.green }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {redeemSuccess.message}
            </div>
            {redeemSuccess.couponCode && (
              <div className="rounded-xl px-3 py-2 text-center space-y-2" style={{ background: "#fff", border: "1px solid #b8e8cc" }}>
                <p className="text-2xl font-black tracking-widest font-mono" style={{ color: THEME.brown }}>
                  {redeemSuccess.couponCode}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(redeemSuccess.couponCode!).catch(() => {});
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="w-full py-2 rounded-lg text-sm font-bold transition"
                  style={{
                    background: codeCopied ? "#d1fae5" : THEME.caramel,
                    color: codeCopied ? "#065f46" : "#fff",
                  }}
                >
                  {codeCopied ? "✓ Copiado!" : "Copiar código"}
                </button>
              </div>
            )}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: THEME.brown }}>Beneficios</h2>
            <Gift className="w-4 h-4" style={{ color: THEME.caramel }} />
          </div>

          {data.rewards.length === 0 ? (
            <div className="rounded-2xl border p-5 text-sm" style={{ background: THEME.card, borderColor: THEME.border, color: "#7b6249" }}>
              Nenhum beneficio disponivel no momento.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.rewards.map((reward) => {
                const disabled = !reward.isAvailable;
                return (
                  <article key={reward.id} className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: THEME.card, borderColor: THEME.border }}>
                    <div className="h-40 bg-gradient-to-br from-[#efe3d1] to-[#dbc2a3] relative">
                      {reward.imageUrl ? (
                        <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover" />
                      ) : reward.couponCode ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                          style={{ background: "linear-gradient(135deg,#3b220f,#8a5527)" }}>
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.13)" }}>
                            <Ticket className="w-6 h-6 text-[#f8d29f]" />
                          </div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8d29f]">Cupom Especial</p>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-semibold" style={{ color: "#7a6247" }}>
                          Beneficio sem imagem
                        </div>
                      )}
                      {reward.couponCode && (
                        <span className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-black" style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>
                          Codigo oculto
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="font-black text-lg leading-tight" style={{ color: THEME.brown }}>{reward.name}</p>
                      <p className="text-sm" style={{ color: "#7b6249" }}>
                        {reward.product ? `${reward.product.name} · ${brl(reward.product.priceCents)}` : reward.description ?? "Resgate com seus pontos atuais."}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold" style={{ color: THEME.caramel }}>{reward.pointsCost.toLocaleString("pt-BR")} pontos</span>
                        <span style={{ color: "#7b6249" }}>{discountLabel(reward)}</span>
                      </div>
                      <button
                        className="w-full h-10 rounded-xl text-white font-bold disabled:opacity-50"
                        style={{ background: `linear-gradient(135deg, ${THEME.caramel}, #a8742f)` }}
                        disabled={disabled || redeemMut.isPending}
                        onClick={() => setSelectedReward(reward)}
                      >
                        {disabled ? "Saldo insuficiente" : reward.isRedeemed ? "Resgatar novamente" : "Resgatar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: THEME.brown }}>Historico</h2>
          <div className="rounded-2xl border overflow-hidden" style={{ background: THEME.card, borderColor: THEME.border }}>
            {data.transactions.length === 0 && (
              <p className="p-5 text-sm" style={{ color: "#7b6249" }}>Nenhuma movimentacao ainda.</p>
            )}
            {data.transactions.map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3 border-b last:border-b-0" style={{ borderColor: "#f0e5d7" }}>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: THEME.brown }}>{sanitizeTxDescription(tx.description)}</p>
                  <p className="text-xs" style={{ color: "#8f7760" }}>{formatDate(tx.createdAtUtc)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${tx.points >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.points >= 0 ? "+" : ""}{tx.points.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs" style={{ color: "#8f7760" }}>saldo: {tx.balanceAfter.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <button onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#7b6249" }}>
          <LogOut className="w-4 h-4" />
          Sair da sessao
        </button>

        <div className="flex items-center gap-2 text-xs" style={{ color: "#8f7760" }}>
          <Ticket className="w-3.5 h-3.5" />
          Beneficios e cupons validos para {data.company.companyName}.
        </div>
      </div>
    </div>
  );
}
