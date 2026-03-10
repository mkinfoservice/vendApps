import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchCustomerByPhone } from "@/features/admin/customers/api";
import type { CustomerDetailDto } from "@/features/admin/customers/types";
import { fetchAdminProducts } from "@/features/admin/products/api";
import type { ProductListItem } from "@/features/admin/products/api";
import { createPhoneOrder } from "@/features/admin/phoneOrder/api";
import {
  Search, ArrowLeft, ArrowRight, Plus, Minus, Trash2,
  Loader2, CheckCircle2, Phone, MapPin, User
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CartItem = {
  product: ProductListItem;
  qty: number;
};

type Step = "search" | "customer" | "cart" | "payment" | "summary";

const STEPS: Step[] = ["search", "customer", "cart", "payment", "summary"];

function stepIndex(s: Step) {
  return STEPS.indexOf(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PhoneOrderBuilder() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("search");

  // Step 1: search
  const [phoneInput, setPhoneInput] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");

  // Step 2: customer data
  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCep, setGuestCep] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestComplement, setGuestComplement] = useState("");

  // Step 3: cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Step 4: payment
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [cashGiven, setCashGiven] = useState("");
  const [deliveryCents, setDeliveryCents] = useState(0);

  // Step 5: result
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: foundCustomer, isFetching: searchingCustomer, error: customerNotFound } = useQuery({
    queryKey: ["customer-by-phone", searchedPhone],
    queryFn: () => fetchCustomerByPhone(searchedPhone),
    enabled: searchedPhone.length >= 8,
    retry: false,
  });

  const { data: productsData, isFetching: loadingProducts } = useQuery({
    queryKey: ["admin-products-phone", productSearch],
    queryFn: () => fetchAdminProducts({ search: productSearch, active: true, pageSize: 50 }),
    enabled: step === "cart",
    placeholderData: (prev) => prev,
  });

  // ── Mutation ──────────────────────────────────────────────────────────────

  const [submitError, setSubmitError] = useState<string | null>(null);

  const confirmMut = useMutation({
    mutationFn: () => {
      const cashGivenCents = paymentMethod === "CASH" ? Math.round(parseFloat(cashGiven) * 100) : undefined;
      return createPhoneOrder({
        customerId: customer?.id,
        customerName: customer ? customer.name : guestName,
        customerPhone: customer ? customer.phone : guestPhone,
        cep: customer ? (customer.cep ?? undefined) : guestCep || undefined,
        address: customer ? (customer.address ?? undefined) : guestAddress || undefined,
        complement: customer ? (customer.complement ?? undefined) : guestComplement || undefined,
        items: cart.map(i => ({ productId: i.product.id, qty: i.qty })),
        paymentMethod,
        deliveryCents: deliveryCents || 0,
        cashGivenCents,
      });
    },
    onSuccess: (data) => {
      setConfirmedOrderId(data.id);
      setConfirmedOrderNumber(data.orderNumber);
      setStep("summary");
    },
    onError: async (e: unknown) => {
      const res = e as Response;
      const body = await res.json?.().catch(() => ({}));
      setSubmitError(body?.error ?? "Erro ao confirmar pedido.");
    },
  });

  // ── Cart helpers ──────────────────────────────────────────────────────────

  function addToCart(product: ProductListItem) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product.id !== productId));
    else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, qty } : i));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.product.priceCents * i.qty, 0);
  const total = subtotal + deliveryCents;
  const cashGivenCents = paymentMethod === "CASH" ? Math.round(parseFloat(cashGiven || "0") * 100) : 0;
  const change = cashGivenCents - total;

  // ── Derived ───────────────────────────────────────────────────────────────

  const effectiveName = customer ? customer.name : guestName;
  const effectivePhone = customer ? customer.phone : guestPhone;

  // ── Step renders ──────────────────────────────────────────────────────────

  function handlePhoneSearch() {
    const cleaned = phoneInput.replace(/\D/g, "");
    if (cleaned.length < 8) return;
    setSearchedPhone(cleaned);
  }

  function handleCustomerConfirm() {
    if (foundCustomer && !customerNotFound) {
      setCustomer(foundCustomer);
    } else {
      setCustomer(null);
      setGuestPhone(searchedPhone);
    }
    setStep("cart");
  }

  // ── Step: SEARCH ──────────────────────────────────────────────────────────

  function renderSearch() {
    return (
      <div className="space-y-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Digite o telefone do cliente para iniciar o atendimento.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="tel"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePhoneSearch()}
              placeholder="(21) 99999-9999"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
              autoFocus
            />
          </div>
          <button
            onClick={handlePhoneSearch}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition flex items-center gap-2"
          >
            {searchingCustomer ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </button>
        </div>

        {searchedPhone && !searchingCustomer && (
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            {foundCustomer ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-semibold">Cliente encontrado</span>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: "var(--text)" }}>{foundCustomer.name}</p>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{foundCustomer.phone}</p>
                  {foundCustomer.address && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <MapPin size={12} />{foundCustomer.address}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setCustomer(foundCustomer); setStep("cart"); }}
                  className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
                >
                  Confirmar e montar pedido
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <User size={16} />
                  <span className="text-sm">Cliente não encontrado — atendimento como convidado</span>
                </div>
                <div className="space-y-2">
                  <input
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="Nome do cliente *"
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                  />
                  <div className="flex gap-2">
                    <input
                      value={guestCep}
                      onChange={e => setGuestCep(e.target.value)}
                      placeholder="CEP"
                      className="w-28 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                    />
                    <input
                      value={guestAddress}
                      onChange={e => setGuestAddress(e.target.value)}
                      placeholder="Endereço (opcional)"
                      className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                </div>
                <button
                  disabled={!guestName.trim()}
                  onClick={handleCustomerConfirm}
                  className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
                >
                  Continuar sem cadastro
                </button>
                <button
                  onClick={() => navigate(`/admin/atendimento/clientes/novo`)}
                  className="w-full py-2 text-sm font-semibold text-brand hover:underline"
                >
                  + Cadastrar novo cliente
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Step: CART ────────────────────────────────────────────────────────────

  function renderCart() {
    const products = productsData?.items ?? [];
    const filtered = productSearch
      ? products.filter(p =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.internalCode ?? "").toLowerCase().includes(productSearch.toLowerCase())
        )
      : products;

    return (
      <div className="space-y-4">
        {/* Cliente selecionado */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface)" }}>
          <User size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{effectiveName}</span>
          <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{effectivePhone}</span>
        </div>

        {/* Busca de produto */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
          />
        </div>

        {/* Lista de produtos */}
        <div className="rounded-2xl border overflow-hidden max-h-64 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          {loadingProducts ? (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} size={18} />
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.map(p => {
                const inCart = cart.find(i => i.product.id === p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: "var(--surface)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{p.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatCents(p.priceCents)}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(p.id, inCart.qty - 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[--surface-2] transition"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-sm font-semibold w-5 text-center" style={{ color: "var(--text)" }}>
                          {inCart.qty}
                        </span>
                        <button
                          onClick={() => setQty(p.id, inCart.qty + 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[--surface-2] transition"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(p)}
                        className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center hover:bg-brand/20 transition"
                        style={{ color: "var(--brand, #7c5cf8)" }}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
              {!filtered.length && (
                <li className="text-center py-6 text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhum produto encontrado.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Carrinho atual */}
        {cart.length > 0 && (
          <div className="rounded-2xl border p-3 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Carrinho ({cart.length} {cart.length === 1 ? "item" : "itens"})
            </p>
            {cart.map(i => (
              <div key={i.product.id} className="flex items-center gap-2">
                <span className="text-sm flex-1 truncate" style={{ color: "var(--text)" }}>
                  {i.qty}× {i.product.name}
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {formatCents(i.product.priceCents * i.qty)}
                </span>
                <button onClick={() => setQty(i.product.id, 0)} style={{ color: "var(--text-muted)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
              <span>Subtotal</span>
              <span>{formatCents(subtotal)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Step: PAYMENT ─────────────────────────────────────────────────────────

  function renderPayment() {
    const methods = ["PIX", "CARD", "CASH"];
    const methodLabel: Record<string, string> = { PIX: "Pix", CARD: "Cartão", CASH: "Dinheiro" };

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Forma de pagamento
          </label>
          <div className="flex gap-2">
            {methods.map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition ${
                  paymentMethod === m ? "bg-brand text-white border-brand" : "hover:bg-[--surface-2]"
                }`}
                style={paymentMethod === m ? {} : { borderColor: "var(--border)", color: "var(--text)" }}
              >
                {methodLabel[m]}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === "CASH" && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Valor em dinheiro (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
              placeholder={`Mín. ${formatCents(total)}`}
              className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
            />
            {cashGivenCents > 0 && cashGivenCents >= total && (
              <p className="text-sm text-green-600 font-semibold">
                Troco: {formatCents(change)}
              </p>
            )}
            {cashGivenCents > 0 && cashGivenCents < total && (
              <p className="text-sm text-red-500">
                Valor insuficiente. Faltam {formatCents(total - cashGivenCents)}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Taxa de entrega (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={deliveryCents > 0 ? (deliveryCents / 100).toFixed(2) : ""}
            onChange={e => setDeliveryCents(Math.round(parseFloat(e.target.value || "0") * 100))}
            placeholder="0,00"
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
          />
        </div>

        {/* Resumo de totais */}
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <Row label="Subtotal" value={formatCents(subtotal)} />
          <Row label="Entrega" value={formatCents(deliveryCents)} />
          <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--border)" }}>
            <Row label="Total" value={formatCents(total)} bold />
          </div>
        </div>
      </div>
    );
  }

  // ── Step: SUMMARY (before confirm) ───────────────────────────────────────

  function renderPreSummary() {
    const cashOk = paymentMethod !== "CASH" || (cashGivenCents >= total);

    return (
      <div className="space-y-4">
        {submitError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {submitError}
          </div>
        )}

        <Section title="Cliente">
          <Row label="Nome" value={effectiveName} />
          <Row label="Telefone" value={effectivePhone} />
          {(customer?.address || guestAddress) && (
            <Row label="Endereço" value={customer?.address ?? guestAddress} />
          )}
        </Section>

        <Section title="Itens">
          {cart.map(i => (
            <Row key={i.product.id} label={`${i.qty}× ${i.product.name}`} value={formatCents(i.product.priceCents * i.qty)} />
          ))}
        </Section>

        <Section title="Pagamento">
          <Row label="Forma" value={paymentMethod} />
          <Row label="Subtotal" value={formatCents(subtotal)} />
          <Row label="Entrega" value={formatCents(deliveryCents)} />
          <Row label="Total" value={formatCents(total)} bold />
          {paymentMethod === "CASH" && cashGivenCents > 0 && (
            <>
              <Row label="Recebe" value={formatCents(cashGivenCents)} />
              <Row label="Troco" value={formatCents(change)} bold />
            </>
          )}
        </Section>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => navigate("/admin/atendimento")}
            className="flex-1 py-3 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Cancelar orçamento
          </button>
          <button
            disabled={!cashOk || confirmMut.isPending}
            onClick={() => { setSubmitError(null); confirmMut.mutate(); }}
            className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {confirmMut.isPending && <Loader2 size={16} className="animate-spin" />}
            Confirmar pedido
          </button>
        </div>
      </div>
    );
  }

  // ── Step: SUMMARY (after confirm — success) ───────────────────────────────

  function renderPostSummary() {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-green-600" />
          </div>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: "var(--text)" }}>Pedido confirmado!</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {confirmedOrderNumber}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/admin/orders/${confirmedOrderId}`)}
            className="flex-1 py-3 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            Ver pedido
          </button>
          <button
            onClick={() => {
              setStep("search"); setPhoneInput(""); setSearchedPhone("");
              setCustomer(null); setGuestName(""); setGuestPhone("");
              setGuestCep(""); setGuestAddress(""); setGuestComplement("");
              setCart([]); setPaymentMethod("PIX"); setCashGiven("");
              setDeliveryCents(0); setConfirmedOrderId(null); setConfirmedOrderNumber(null);
            }}
            className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
          >
            Novo atendimento
          </button>
        </div>
      </div>
    );
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const canProceed: Record<Step, boolean> = {
    search: (!!foundCustomer && !!customer) || (!!guestName.trim() && !!guestPhone),
    customer: true,
    cart: cart.length > 0,
    payment: paymentMethod !== "CASH" || (cashGivenCents >= total && total > 0),
    summary: false,
  };

  function goNext() {
    const idx = stepIndex(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function goPrev() {
    const idx = stepIndex(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  const stepTitles: Record<Step, string> = {
    search: "Identificar cliente",
    customer: "Dados do cliente",
    cart: "Montar carrinho",
    payment: "Pagamento",
    summary: confirmedOrderId ? "Pedido confirmado" : "Resumo do orçamento",
  };

  const isSuccessScreen = step === "summary" && !!confirmedOrderId;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (stepIndex(step) > 0 && !isSuccessScreen ? goPrev() : navigate("/admin/atendimento"))}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[--surface-2] transition"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
              {stepTitles[step]}
            </h1>
            {!isSuccessScreen && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Etapa {stepIndex(step) + 1} de {STEPS.length}
              </p>
            )}
          </div>
        </div>

        {/* Step progress dots */}
        {!isSuccessScreen && (
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex(step) ? "bg-brand" : ""}`}
                style={i > stepIndex(step) ? { backgroundColor: "var(--border)" } : {}}
              />
            ))}
          </div>
        )}

        {/* Step content */}
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          {step === "search" && renderSearch()}
          {step === "customer" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Confirme os dados antes de continuar.</p>
              <Row label="Nome" value={effectiveName} />
              <Row label="Telefone" value={effectivePhone} />
              {(customer?.address || guestAddress) && <Row label="Endereço" value={customer?.address ?? guestAddress} />}
            </div>
          )}
          {step === "cart" && renderCart()}
          {step === "payment" && renderPayment()}
          {step === "summary" && !confirmedOrderId && renderPreSummary()}
          {step === "summary" && confirmedOrderId && renderPostSummary()}
        </div>

        {/* Next button — shown for steps that need explicit "next" */}
        {step !== "search" && step !== "summary" && (
          <div className="mt-4">
            <button
              onClick={goNext}
              disabled={!canProceed[step]}
              className="w-full py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {step === "payment" ? "Ver resumo" : "Próximo"}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Mini helpers ──────────────────────────────────────────────────────────────

function Row({ label, value, bold }: { label: string; value: string | undefined | null; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={bold ? "font-bold" : "font-medium"} style={{ color: "var(--text)" }}>{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}
