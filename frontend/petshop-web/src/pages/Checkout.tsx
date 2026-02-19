import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/features/cart/cart";
import { useNavigate } from "react-router-dom";
import { CreateOrder, type CreateOrderRequest, type CreateOrderResponse } from "@/features/orders/api";
import { fetchAddressByCep } from "@/features/shipping/viacep";

/* =========================
   Utils
========================= */
function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Aceita "100", "100.00", "100,00", "1.234,56" e retorna centavos */
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
  name: string;
  phone: string;
  cep: string;
  address: string;
  houseNumber: string;
  complement: string;
};

const STORE_WHATSAPP_NUMBER = "5521992329239";
function openWhatsApp(text: string) {
  const url = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

type ReviewSnapshot = {
  name: string;
  phone: string;
  cep: string;
  fullAddress: string;
  items: Array<{ qty: number; name: string; totalCents: number }>;
  paymentMethodStr: PaymentMethod;
  paymentLabel: string;
  cashGivenCents: number | null;
  changeEstimateCents: number | null;

  // totais UI (prévia)
  subtotalCentsUI: number;
  deliveryCentsUI: number;
  totalCentsUI: number;
};

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();

  const draft: CustomerDraft | null = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "null");
    } catch {
      return null;
    }
  }, []);

  // dados
  const [name, setName] = useState(draft?.name ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [cep, setCep] = useState(draft?.cep ?? "");
  const [address, setAddress] = useState(draft?.address ?? "");
  const [houseNumber, setHouseNumber] = useState(draft?.houseNumber ?? "");
  const [complement, setComplement] = useState(draft?.complement ?? "");

  // ViaCEP parts (p/ montar endereço certo)
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cityUf, setCityUf] = useState("");

  // CEP UI
  const [addressHint, setAddressHint] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // pagamento
  const [payment, setPayment] = useState<PaymentMethod>("PIX");
  const [cashGiven, setCashGiven] = useState("");

  // modal revisão (agora é só “prévia”)
  const [review, setReview] = useState<ReviewSnapshot | null>(null);
  const [sending, setSending] = useState(false);

  // persist draft
  useEffect(() => {
    const payload: CustomerDraft = { name, phone, cep, address, houseNumber, complement };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }, [name, phone, cep, address, houseNumber, complement]);

  /* =========================
     CEP -> ViaCEP
  ========================= */
  useEffect(() => {
    const onlyDigits = cep.replace(/\D/g, "");

    setCepError("");
    setAddressHint("");

    if (onlyDigits.length !== 8) {
      setStreet("");
      setNeighborhood("");
      setCityUf("");
      return;
    }

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

        setStreet(baseStreet);
        setNeighborhood(baseNeighborhood);
        setCityUf(baseCityUf);

        const hint =
          [baseStreet, baseNeighborhood].filter(Boolean).join(", ") + (baseCityUf ? ` - ${baseCityUf}` : "");
        setAddressHint(hint);

        // campo editável: preenche só se estiver vazio
        setAddress((prev) => (prev.trim().length ? prev : baseStreet));
      } catch (e: any) {
        if (!alive) return;
        setCepError(e?.message ?? "Erro ao consultar CEP.");
      } finally {
        if (alive) setCepLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [cep]);

  /* =========================
     Totals (UI only)
  ========================= */
  const deliveryCentsUI = useMemo(() => {
    if (cep.trim().length < 8) return 0;
    return 1200; // MVP
  }, [cep]);

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
    ]
      .filter(Boolean)
      .join(" ");

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

  /* =========================
     WhatsApp text (backend truth)
  ========================= */
  function buildWhatsText(created: CreateOrderResponse, snap: ReviewSnapshot) {
    const lines: string[] = [];

    lines.push(`*Pedido:* ${created.orderNumber}`);
    lines.push("");
    lines.push("*Novo Pedido - Petshop*");
    lines.push("");
    lines.push(`*Cliente:* ${snap.name}`);
    lines.push(`*Telefone:* ${snap.phone}`);
    lines.push(`*CEP:* ${snap.cep}`);
    lines.push(`*Endereço:* ${snap.fullAddress}`);
    lines.push("");

    lines.push("*Itens:*");
    snap.items.forEach((i) => {
      lines.push(`- ${i.qty}x ${i.name} — ${formatBRL(i.totalCents)}`);
    });

    lines.push("");
    lines.push(`*Subtotal:* ${formatBRL(created.subtotalCents)}`);
    lines.push(`*Entrega:* ${formatBRL(created.deliveryCents)}`);
    lines.push(`*Total:* ${formatBRL(created.totalCents)}`);
    lines.push("");
    lines.push(`*Pagamento:* ${paymentLabel(created.paymentMethodStr ?? snap.paymentMethodStr)}`);

    if ((created.paymentMethodStr ?? "").toUpperCase() === "CASH") {
      if (typeof created.cashGivenCents === "number") lines.push(`*Troco para:* ${formatBRL(created.cashGivenCents)}`);
      if (typeof created.changeCents === "number") lines.push(`*Troco:* ${formatBRL(created.changeCents)}`);
    }

    return lines.join("\n");
  }

  /* =========================
     Review modal open (NO backend call)
  ========================= */
  function handleOpenReview() {
    const items = cart.items.map((i) => ({
      qty: i.qty,
      name: i.product.name,
      totalCents: (i.product.priceCents ?? 0) * i.qty,
    }));

    const changeEstimate =
      payment === "CASH" && cashGivenCents != null ? cashGivenCents - totalCentsUI : null;

    const snap: ReviewSnapshot = {
      name: name.trim(),
      phone: phone.trim(),
      cep: cep.trim(),
      fullAddress: fullAddressUI,
      items,
      paymentMethodStr: payment,
      paymentLabel: paymentLabel(payment),
      cashGivenCents: payment === "CASH" ? cashGivenCents : null,
      changeEstimateCents: payment === "CASH" ? changeEstimate : null,
      subtotalCentsUI: cart.subtotalCents,
      deliveryCentsUI,
      totalCentsUI,
    };

    setReview(snap);
  }

  function closeModalToEdit() {
    if (sending) return;
    setReview(null);
  }

  /* =========================
     Confirm send: create order THEN open WhatsApp
  ========================= */
  async function confirmSendWhatsApp() {
    if (!review) return;

    try {
      setSending(true);

      const payload: CreateOrderRequest = {
        name: review.name,
        phone: review.phone,
        cep: review.cep,
        address: review.fullAddress,
        paymentMethodStr: review.paymentMethodStr,
        items: cart.items.map((i) => ({
          productId: i.product.id,
          qty: i.qty,
        })),
        ...(review.paymentMethodStr === "CASH" ? { cashGivenCents: review.cashGivenCents ?? undefined } : {}),
      };

      const created = await CreateOrder(payload);

      const text = buildWhatsText(created, review);
      openWhatsApp(text);

      cart.clear();
      setReview(null);
      navigate("/");
    } catch (err: any) {
      alert(err?.message ?? "Erro ao criar pedido.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-md px-4 pb-10 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-extrabold">Finalizar pedido</div>
            <div className="text-sm text-zinc-300">Confirme seus dados e pagamento.</div>
          </div>
          <Button variant="outline" className="rounded-xl" type="button" onClick={() => navigate("/")}>
            Voltar
          </Button>
        </div>

        {/* Resumo */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Resumo</div>
            <Badge>{cart.totalItems} item(ns)</Badge>
          </div>

          <div className="flex justify-between text-sm text-zinc-300">
            <span>Subtotal</span>
            <span className="text-zinc-50 font-bold">{formatBRL(cart.subtotalCents)}</span>
          </div>

          <div className="flex justify-between text-sm text-zinc-300">
            <span>Entrega</span>
            <span className="text-zinc-50 font-bold">{formatBRL(deliveryCentsUI)}</span>
          </div>

          <div className="flex justify-between text-base">
            <span className="font-extrabold">Total</span>
            <span className="font-extrabold">{formatBRL(totalCentsUI)}</span>
          </div>
        </div>

        {/* Dados */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="text-sm font-extrabold">Seus dados</div>

          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />

          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="Telefone (WhatsApp) - somente números"
          />

          <Input
            value={cep}
            onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Digite seu CEP para carregar o endereço"
          />

          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua (auto pelo CEP)" />

          <Input
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Número"
          />

          <Input
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            placeholder="Complemento (Ex. casa 6 / Bloco 5 Apto 202)"
          />

          {cepLoading && <div className="text-xs text-zinc-300">Buscando endereço pelo CEP...</div>}
          {cepError && <div className="text-xs text-red-300">{cepError}</div>}
          {!cepLoading && !cepError && addressHint ? (
            <div className="text-xs text-zinc-400">Sugestão: {addressHint}</div>
          ) : null}

          <div className="text-xs text-zinc-400">Endereço final: {fullAddressUI || "(preencha)"}</div>
        </div>

        {/* Pagamento */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="text-sm font-extrabold">Pagamento</div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant={payment === "PIX" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setPayment("PIX")}
            >
              PIX (QR Code na entrega)
            </Button>

            <Button
              type="button"
              variant={payment === "CARD_ON_DELIVERY" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setPayment("CARD_ON_DELIVERY")}
            >
              Cartão na entrega
            </Button>

            <Button
              type="button"
              variant={payment === "CASH" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setPayment("CASH")}
            >
              Dinheiro
            </Button>
          </div>

          {payment === "CASH" && (
            <div className="space-y-2">
              <div className="text-xs text-zinc-300">
                Troco para (opcional): informe quanto você vai pagar em dinheiro (ex: 100,00).
              </div>

              <Input value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="Ex: 100,00" />

              {(() => {
                const cents = cashGivenCents;
                if (cents === null || cents <= 0) return null;

                const change = cents - totalCentsUI;

                return (
                  <div className="text-xs text-zinc-300">
                    {change < 0 ? (
                      <span className="text-red-300">Falta {formatBRL(Math.abs(change))} para completar o total.</span>
                    ) : (
                      <span className="text-emerald-300">Troco estimado: {formatBRL(change)}</span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="text-xs text-zinc-400">
            Cartão: pagamento no ato da entrega. <br />
            PIX: QR Code no ato da entrega. <br />
            Dinheiro: informe troco se precisar.
          </div>
        </div>

        {/* Ações */}
        <Button
          type="button"
          className="w-full rounded-2xl font-black h-12"
          disabled={!canSubmit}
          onClick={handleOpenReview}
        >
          Revisar pedido
        </Button>

        <div className="text-xs text-zinc-400">
          Estamos quase finalizando sua entrega.
        </div>
      </div>

      {/* =========================
          MODAL (Mobile-safe clickable)
      ========================= */}
      {review && (
        <div className="fixed inset-0 z-50 bg-black/70 px-3 py-4 sm:p-6 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden flex flex-col max-h-[90svh]">
            {/* Header */}
            <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold">Revisar pedido</div>
                  <div className="text-xs text-zinc-400">Confira antes de enviar no WhatsApp.</div>
                </div>
                <Button className="rounded-xl" type="button" onClick={closeModalToEdit} disabled={sending}>
                  Voltar
                </Button>
              </div>

              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="text-xs text-zinc-400">Prévia</div>
                <div className="text-sm text-zinc-200">
                  O número do pedido aparece depois que você confirmar o envio.
                </div>
              </div>
            </div>

            {/* Body (scroll) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* cliente */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
                <div className="text-sm font-extrabold">Cliente</div>
                <div className="text-sm text-zinc-200">{review.name}</div>
                <div className="text-sm text-zinc-400">{review.phone}</div>
              </div>

              {/* endereço */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
                <div className="text-sm font-extrabold">Entrega</div>
                <div className="text-sm text-zinc-300">CEP: {review.cep}</div>
                <div className="text-sm text-zinc-200">{review.fullAddress}</div>
              </div>

              {/* itens */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <div className="text-sm font-extrabold">Itens</div>
                <div className="space-y-2">
                  {review.items.map((i, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 text-sm">
                      <div className="text-zinc-200">
                        <span className="font-bold">{i.qty}x</span> {i.name}
                      </div>
                      <div className="font-bold text-zinc-50 whitespace-nowrap">{formatBRL(i.totalCents)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* totais UI */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <div className="flex justify-between text-sm text-zinc-300">
                  <span>Subtotal</span>
                  <span className="font-bold text-zinc-50">{formatBRL(review.subtotalCentsUI)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-300">
                  <span>Entrega</span>
                  <span className="font-bold text-zinc-50">{formatBRL(review.deliveryCentsUI)}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-extrabold">Total</span>
                  <span className="font-extrabold">{formatBRL(review.totalCentsUI)}</span>
                </div>
              </div>

              {/* pagamento */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <div className="text-sm font-extrabold">Pagamento</div>
                <div className="text-sm text-zinc-200">{review.paymentLabel}</div>

                {review.paymentMethodStr === "CASH" && (
                  <div className="text-sm text-zinc-300 space-y-1">
                    <div>
                      Troco para:{" "}
                      <span className="font-bold text-zinc-50">
                        {review.cashGivenCents != null ? formatBRL(review.cashGivenCents) : "—"}
                      </span>
                    </div>
                    <div>
                      Troco estimado:{" "}
                      <span className="font-bold text-zinc-50">
                        {review.changeEstimateCents != null ? formatBRL(review.changeEstimateCents) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer (SAFE AREA) */}
            <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl" type="button" onClick={closeModalToEdit} disabled={sending}>
                  Ajustar pedido
                </Button>
                <Button className="rounded-xl font-extrabold" type="button" onClick={confirmSendWhatsApp} disabled={sending}>
                  {sending ? "Enviando..." : "Enviar no WhatsApp"}
                </Button>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                O pedido será criado no backend ao confirmar “Enviar no WhatsApp”.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
