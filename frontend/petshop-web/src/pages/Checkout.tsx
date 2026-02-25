import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/features/cart/cart";
import { useNavigate } from "react-router-dom";
import { CreateOrder, type CreateOrderRequest, type CreateOrderResponse } from "@/features/orders/api";
import { fetchAddressByCep } from "@/features/shipping/viacep";
import { ArrowLeft, CheckCircle2, ChevronRight, MapPin, CreditCard, Banknote, QrCode, Package } from "lucide-react";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCep(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (d.length === 0) return "";
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

type PaymentMethod = "PIX" | "CARD_ON_DELIVERY" | "CASH";

function paymentLabel(pm: string): string {
  const key = (pm ?? "").trim().toUpperCase();
  if (key === "PIX") return "PIX";
  if (key === "CARD_ON_DELIVERY") return "Cartão na entrega";
  if (key === "CASH") return "Dinheiro";
  return key || "—";
}

const LS_KEY = "petshop_checkout_customer_v2";
type CustomerDraft = {
  name: string; phone: string; cep: string;
  address: string; houseNumber: string; complement: string;
};

const STORE_WHATSAPP_NUMBER = "5521992329239";
function openWhatsApp(text: string) {
  const url = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

type ReviewSnapshot = {
  name: string; phone: string; cep: string; fullAddress: string;
  items: Array<{ qty: number; name: string; totalCents: number }>;
  paymentMethodStr: PaymentMethod; paymentLabel: string;
  cashGivenCents: number | null; changeEstimateCents: number | null;
  subtotalCentsUI: number; deliveryCentsUI: number; totalCentsUI: number;
};

/* ─── Tela de confirmação ────────────────────────── */
function ConfirmationScreen({
  onNewOrder,
  onCatalog,
}: {
  onNewOrder: () => void;
  onCatalog: () => void;
}) {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Ícone */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-gray-900">Pedido Confirmado!</h1>
        <p className="mt-2 text-sm text-gray-500">Seu pedido foi recebido com sucesso</p>
        <p className="mt-1 text-xs text-gray-400 leading-relaxed">
          Em breve você receberá uma confirmação no seu telefone com o tempo estimado de entrega.
        </p>

        {/* Status card */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: "#7c5cf8", boxShadow: "0 0 8px rgba(124,92,248,0.5)" }}
            />
            <span className="font-bold text-gray-900 text-sm">Preparando seu pedido...</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400 ml-[22px]">
            Acompanhe o status pelo WhatsApp
          </p>
        </div>

        {/* Botões */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onNewOrder}
            className="w-full py-3.5 rounded-2xl font-black text-base text-white transition hover:brightness-110 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            Fazer Novo Pedido
          </button>

          <button
            type="button"
            onClick={onCatalog}
            className="w-full py-3.5 rounded-2xl font-bold text-base text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition active:scale-[0.99]"
          >
            Voltar ao Catálogo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Campo de formulário com label ─────────────── */
function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8] focus:border-transparent transition";

/* ─── Página de Checkout ─────────────────────────── */
export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();

  const draft: CustomerDraft | null = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
    catch { return null; }
  }, []);

  const [name, setName] = useState(draft?.name ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [cep, setCep] = useState(draft?.cep ?? "");
  const [address, setAddress] = useState(draft?.address ?? "");
  const [houseNumber, setHouseNumber] = useState(draft?.houseNumber ?? "");
  const [complement, setComplement] = useState(draft?.complement ?? "");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cityUf, setCityUf] = useState("");
  const [addressHint, setAddressHint] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("PIX");
  const [cashGiven, setCashGiven] = useState("");
  const [review, setReview] = useState<ReviewSnapshot | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const payload: CustomerDraft = { name, phone, cep, address, houseNumber, complement };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }, [name, phone, cep, address, houseNumber, complement]);

  useEffect(() => {
    const onlyDigits = cep.replace(/\D/g, "");
    setCepError(""); setAddressHint("");
    if (onlyDigits.length !== 8) { setStreet(""); setNeighborhood(""); setCityUf(""); return; }
    let alive = true;
    (async () => {
      try {
        setCepLoading(true);
        const data = await fetchAddressByCep(onlyDigits);
        const baseStreet = (data.logradouro ?? "").trim();
        const baseNeighborhood = (data.bairro ?? "").trim();
        const baseCity = (data.localidade ?? "").trim();
        const baseUf = (data.uf ?? "").trim();
        const baseCityUf = [baseCity, baseUf].filter(Boolean).join("/");
        if (!alive) return;
        setStreet(baseStreet); setNeighborhood(baseNeighborhood); setCityUf(baseCityUf);
        const hint = [baseStreet, baseNeighborhood].filter(Boolean).join(", ") + (baseCityUf ? ` - ${baseCityUf}` : "");
        setAddressHint(hint);
        setAddress((prev) => (prev.trim().length ? prev : baseStreet));
      } catch (e: any) {
        if (!alive) return;
        setCepError(e?.message ?? "Erro ao consultar CEP.");
      } finally {
        if (alive) setCepLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cep]);

  const deliveryCentsUI = useMemo(() => (cep.trim().length < 8 ? 0 : 1200), [cep]);
  const totalCentsUI = cart.subtotalCents + deliveryCentsUI;
  const cashGivenCents = useMemo(() => {
    if (payment !== "CASH") return null;
    return parseBRLToCents(cashGiven);
  }, [payment, cashGiven]);

  const fullAddressUI = useMemo(() => {
    const st = (street || address).trim();
    const nb = neighborhood.trim();
    const cu = cityUf.trim();
    const numberAndComplement = [
      houseNumber.trim() ? `Nº ${houseNumber.trim()}` : null,
      complement.trim() ? complement.trim() : null,
    ].filter(Boolean).join(" ");
    const left = numberAndComplement ? `${st}, ${numberAndComplement}` : st;
    return [left, nb, cu].filter(Boolean).join(" - ");
  }, [street, address, neighborhood, cityUf, houseNumber, complement]);

  const canSubmit =
    cart.items.length > 0 &&
    name.trim().length >= 3 &&
    phone.trim().length >= 10 &&
    cep.trim().length >= 8 &&
    address.trim().length >= 3 &&
    (payment !== "CASH" || (cashGivenCents !== null && cashGivenCents >= totalCentsUI));

  function buildWhatsText(created: CreateOrderResponse, snap: ReviewSnapshot) {
    const lines: string[] = [];
    lines.push(`*Pedido:* ${created.orderNumber}`, "");
    lines.push("*Novo Pedido - vendApps*", "");
    lines.push(`*Cliente:* ${snap.name}`, `*Telefone:* ${snap.phone}`, `*CEP:* ${snap.cep}`, `*Endereço:* ${snap.fullAddress}`, "");
    lines.push("*Itens:*");
    snap.items.forEach((i) => lines.push(`- ${i.qty}x ${i.name} — ${formatBRL(i.totalCents)}`));
    lines.push("", `*Subtotal:* ${formatBRL(created.subtotalCents)}`, `*Entrega:* ${formatBRL(created.deliveryCents)}`, `*Total:* ${formatBRL(created.totalCents)}`, "");
    lines.push(`*Pagamento:* ${paymentLabel(created.paymentMethodStr ?? snap.paymentMethodStr)}`);
    if ((created.paymentMethodStr ?? "").toUpperCase() === "CASH") {
      if (typeof created.cashGivenCents === "number") lines.push(`*Troco para:* ${formatBRL(created.cashGivenCents)}`);
      if (typeof created.changeCents === "number") lines.push(`*Troco:* ${formatBRL(created.changeCents)}`);
    }
    return lines.join("\n");
  }

  function handleOpenReview() {
    const items = cart.items.map((i) => ({ qty: i.qty, name: i.product.name, totalCents: (i.product.priceCents ?? 0) * i.qty }));
    const changeEstimate = payment === "CASH" && cashGivenCents != null ? cashGivenCents - totalCentsUI : null;
    setReview({
      name: name.trim(), phone: phone.trim(), cep: cep.trim(), fullAddress: fullAddressUI,
      items, paymentMethodStr: payment, paymentLabel: paymentLabel(payment),
      cashGivenCents: payment === "CASH" ? cashGivenCents : null,
      changeEstimateCents: payment === "CASH" ? changeEstimate : null,
      subtotalCentsUI: cart.subtotalCents, deliveryCentsUI, totalCentsUI,
    });
  }

  function closeModalToEdit() { if (sending) return; setReview(null); }

  async function confirmSendWhatsApp() {
    if (!review) return;
    try {
      setSending(true);
      const payload: CreateOrderRequest = {
        name: review.name, phone: review.phone, cep: review.cep, address: review.fullAddress,
        paymentMethodStr: review.paymentMethodStr,
        items: cart.items.map((i) => ({ productId: i.product.id, qty: i.qty })),
        ...(review.paymentMethodStr === "CASH" ? { cashGivenCents: review.cashGivenCents ?? undefined } : {}),
      };
      const created = await CreateOrder(payload);
      openWhatsApp(buildWhatsText(created, review));
      cart.clear();
      setReview(null);
      setConfirmed(true);
    } catch (err: any) {
      alert(err?.message ?? "Erro ao criar pedido.");
    } finally {
      setSending(false);
    }
  }

  /* Tela pós-confirmação */
  if (confirmed) {
    return (
      <ConfirmationScreen
        onNewOrder={() => navigate("/")}
        onCatalog={() => navigate("/")}
      />
    );
  }

  /* Opções de pagamento */
  const paymentOptions: Array<{ key: PaymentMethod; label: string; desc: string; icon: React.ReactNode }> = [
    { key: "PIX", label: "PIX", desc: "QR Code na entrega", icon: <QrCode className="w-5 h-5" /> },
    { key: "CARD_ON_DELIVERY", label: "Cartão na entrega", desc: "Débito ou crédito", icon: <CreditCard className="w-5 h-5" /> },
    { key: "CASH", label: "Dinheiro", desc: "Informe o troco se precisar", icon: <Banknote className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-dvh bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="font-black text-gray-900 text-base leading-tight">Finalizar Pedido</h1>
            <p className="text-xs text-gray-400">Confirme seus dados</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-32 space-y-4">

        {/* Resumo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="font-black text-gray-900 text-sm">Resumo do pedido</span>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {cart.totalItems} item(s)
            </span>
          </div>
          <div className="px-5 py-3 space-y-2">
            {cart.items.map((i) => (
              <div key={i.product.id} className="flex justify-between text-sm">
                <span className="text-gray-600 min-w-0 mr-2">
                  <span className="font-bold text-gray-900">{i.qty}×</span> {i.product.name}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap shrink-0">
                  {formatBRL(i.product.priceCents * i.qty)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900 tabular-nums">{formatBRL(cart.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Entrega</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {deliveryCentsUI > 0 ? formatBRL(deliveryCentsUI) : "—"}
              </span>
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex justify-between text-base font-black">
              <span className="text-gray-900">Total</span>
              <span className="tabular-nums" style={{ color: "#7c5cf8" }}>{formatBRL(totalCentsUI)}</span>
            </div>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-4">
          <h2 className="font-black text-gray-900 text-sm">Seus dados</h2>

          <FormField label="Nome completo">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </FormField>

          <FormField label="Telefone (WhatsApp)">
            <input
              className={inputCls}
              value={maskPhone(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="(XX) XXXXX-XXXX"
              inputMode="numeric"
            />
          </FormField>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <h2 className="font-black text-gray-900 text-sm">Endereço de entrega</h2>
          </div>

          <FormField
            label="CEP"
            hint={cepLoading ? "Buscando endereço..." : (addressHint ? `Sugestão: ${addressHint}` : undefined)}
            error={cepError || undefined}
          >
            <input
              className={inputCls}
              value={maskCep(cep)}
              onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="XXXXX-XXX"
              inputMode="numeric"
            />
          </FormField>

          <FormField label="Rua / Logradouro">
            <input
              className={inputCls}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Preenchido automaticamente pelo CEP"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Número">
              <input
                className={inputCls}
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Ex: 123"
                inputMode="numeric"
              />
            </FormField>

            <FormField label="Complemento">
              <input
                className={inputCls}
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Apto, bloco..."
              />
            </FormField>
          </div>

          {fullAddressUI && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: "rgba(124,92,248,0.08)" }}
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#7c5cf8" }} />
              <p className="text-xs text-gray-600 leading-relaxed">{fullAddressUI}</p>
            </div>
          )}
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <h2 className="font-black text-gray-900 text-sm">Forma de pagamento</h2>
          </div>

          <div className="space-y-2">
            {paymentOptions.map(({ key, label, desc, icon }) => {
              const active = payment === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPayment(key)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.99]",
                    active ? "border-[#7c5cf8]" : "border-gray-200 hover:border-gray-300",
                  ].join(" ")}
                  style={active ? { backgroundColor: "rgba(124,92,248,0.07)" } : undefined}
                >
                  <div
                    className={[
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
                      active ? "text-white" : "bg-gray-100 text-gray-500",
                    ].join(" ")}
                    style={active ? { background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" } : undefined}
                  >
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={["text-sm font-bold", active ? "" : "text-gray-900"].join(" ")} style={active ? { color: "#7c5cf8" } : undefined}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <div
                    className={["w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all", active ? "" : "border-gray-300"].join(" ")}
                    style={active ? { borderColor: "#7c5cf8" } : undefined}
                  >
                    {active && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7c5cf8" }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {payment === "CASH" && (
            <div className="space-y-2 pt-1">
              <FormField
                label="Troco para"
                hint="Informe quanto você vai pagar (ex: 100,00)"
              >
                <input
                  className={inputCls}
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  placeholder="Ex: 100,00"
                  inputMode="decimal"
                />
              </FormField>
              {(() => {
                const cents = cashGivenCents;
                if (cents === null || cents <= 0) return null;
                const change = cents - totalCentsUI;
                return (
                  <div
                    className={["text-xs font-semibold px-3 py-2 rounded-xl", change < 0 ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"].join(" ")}
                  >
                    {change < 0
                      ? `⚠️ Falta ${formatBRL(Math.abs(change))} para completar o total.`
                      : `✓ Troco estimado: ${formatBRL(change)}`}
                  </div>
                );
              })()}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Cartão: pagamento no ato da entrega. PIX: QR Code na entrega. Dinheiro: informe troco se precisar.
          </p>
        </div>

      </div>

      {/* CTA fixo no bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            className="w-full py-3.5 rounded-2xl font-black text-base text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
            disabled={!canSubmit}
            onClick={handleOpenReview}
          >
            Revisar pedido
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            Estamos quase finalizando sua entrega.
          </p>
        </div>
      </div>

      {/* Modal de revisão */}
      {review && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92svh] shadow-2xl">

            {/* Handle mobile */}
            <div className="flex justify-center pt-3 sm:hidden shrink-0">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>

            {/* Modal header */}
            <div className="px-5 pt-4 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Revisar pedido</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Confira antes de enviar no WhatsApp.</p>
                </div>
                <button
                  type="button"
                  onClick={closeModalToEdit}
                  disabled={sending}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition disabled:opacity-50 shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">

              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cliente</p>
                <p className="text-sm font-semibold text-gray-900">{review.name}</p>
                <p className="text-sm text-gray-500">{maskPhone(review.phone)}</p>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entrega</p>
                <p className="text-xs text-gray-400">CEP: {maskCep(review.cep)}</p>
                <p className="text-sm text-gray-900">{review.fullAddress}</p>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Itens</p>
                {review.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-700 min-w-0">
                      <span className="font-bold text-gray-900">{i.qty}×</span> {i.name}
                    </span>
                    <span className="font-bold text-gray-900 whitespace-nowrap tabular-nums shrink-0">
                      {formatBRL(i.totalCents)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{formatBRL(review.subtotalCentsUI)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Entrega</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{formatBRL(review.deliveryCentsUI)}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between text-base font-black">
                  <span className="text-gray-900">Total</span>
                  <span className="tabular-nums" style={{ color: "#7c5cf8" }}>{formatBRL(review.totalCentsUI)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pagamento</p>
                <p className="text-sm font-semibold text-gray-900">{review.paymentLabel}</p>
                {review.paymentMethodStr === "CASH" && (
                  <div className="text-sm text-gray-500 space-y-0.5">
                    <div>
                      Troco para:{" "}
                      <span className="font-bold text-gray-900">
                        {review.cashGivenCents != null ? formatBRL(review.cashGivenCents) : "—"}
                      </span>
                    </div>
                    <div>
                      Troco estimado:{" "}
                      <span className="font-bold text-gray-900">
                        {review.changeEstimateCents != null ? formatBRL(review.changeEstimateCents) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeModalToEdit}
                  disabled={sending}
                  className="h-12 rounded-xl border border-gray-200 font-bold text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 active:scale-[0.99]"
                >
                  Ajustar pedido
                </button>
                <button
                  type="button"
                  onClick={confirmSendWhatsApp}
                  disabled={sending}
                  className="h-12 rounded-xl font-black text-sm text-white transition hover:brightness-110 disabled:opacity-50 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
                >
                  {sending ? "Enviando..." : "Enviar no WhatsApp"}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                O pedido será criado ao confirmar.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
