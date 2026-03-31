import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchCustomerByPhoneOrCpf, createCustomer } from "@/features/admin/customers/api";
import type { CustomerDetailDto } from "@/features/admin/customers/types";
import { fetchAdminProductById, fetchAdminProducts } from "@/features/admin/products/api";
import type { ProductAddon, ProductDetail, ProductListItem } from "@/features/admin/products/api";
import { createPhoneOrder } from "@/features/admin/phoneOrder/api";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Minus,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";

type Step = "search" | "customer" | "cart" | "payment" | "summary";
const STEPS: Step[] = ["search", "customer", "cart", "payment", "summary"];
type SearchMode = "lookup" | "quick";

type CartItem = {
  key: string;
  qty: number;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    basePriceCents: number;
  };
  addonIds: string[];
  addons: ProductAddon[];
};

function stepIndex(step: Step) {
  return STEPS.indexOf(step);
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildCartKey(productId: string, addonIds: string[]) {
  return `${productId}::${[...addonIds].sort().join(",")}`;
}

function paymentMethodLabel(method: string) {
  if (method === "PIX") return "Pix";
  if (method === "CARD") return "Cartão";
  if (method === "CASH") return "Dinheiro";
  return method;
}

function toPseudoProduct(item: CartItem): ProductListItem {
  return {
    id: item.product.id,
    name: item.product.name,
    imageUrl: item.product.imageUrl,
    priceCents: item.product.basePriceCents,
    hasAddons: true,
    isBestSeller: false,
    slug: "",
    internalCode: null,
    barcode: null,
    categoryName: null,
    brandName: null,
    unit: "UN",
    costCents: 0,
    marginPercent: 0,
    stockQty: 0,
    isActive: true,
    updatedAtUtc: null,
  };
}

export default function PhoneOrderBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("search");
  const [searchMode, setSearchMode] = useState<SearchMode>("lookup");

  const [lookupInput, setLookupInput] = useState("");
  const [lookupValue, setLookupValue] = useState("");

  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCpf, setGuestCpf] = useState("");
  const [guestCep, setGuestCep] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestComplement, setGuestComplement] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [configuringProductId, setConfiguringProductId] = useState<string | null>(null);
  const [configQty, setConfigQty] = useState(1);
  const [configSelectedAddonIds, setConfigSelectedAddonIds] = useState<string[]>([]);
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [cashGiven, setCashGiven] = useState("");
  const [deliveryCents, setDeliveryCents] = useState(0);

  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError]     = useState<string | null>(null);

  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: foundCustomer, isFetching: searchingCustomer, error: lookupError } = useQuery({
    queryKey: ["customer-by-phone-or-cpf", lookupValue],
    queryFn: () => fetchCustomerByPhoneOrCpf(lookupValue),
    enabled: lookupValue.length >= 8,
    retry: false,
  });

  const { data: productsData, isFetching: loadingProducts } = useQuery({
    queryKey: ["admin-products-phone-all"],
    queryFn: () => fetchAdminProducts({ active: true, excludeSupplies: true, pageSize: 300 }),
    enabled: step === "cart",
    placeholderData: (prev) => prev,
  });

  const { data: configuringProduct, isFetching: loadingConfigProduct } = useQuery({
    queryKey: ["admin-product-detail", configuringProductId],
    queryFn: () => fetchAdminProductById(configuringProductId!),
    enabled: !!configuringProductId,
  });

  const products = productsData?.items ?? [];
  const orderedProducts = useMemo(
    () =>
      [...products].sort((a, b) => {
        if (a.isBestSeller !== b.isBestSeller) return a.isBestSeller ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      }),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return orderedProducts;
    return orderedProducts.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.internalCode ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [orderedProducts, productSearch]);

  const confirmMut = useMutation({
    mutationFn: () => {
      const cashGivenCents = paymentMethod === "CASH" ? Math.round(parseFloat(cashGiven || "0") * 100) : undefined;
      return createPhoneOrder({
        customerId: customer?.id,
        customerName: customer ? customer.name : guestName,
        customerPhone: customer ? customer.phone : guestPhone,
        cep: customer ? (customer.cep ?? undefined) : guestCep || undefined,
        address: customer ? (customer.address ?? undefined) : guestAddress || undefined,
        complement: customer ? (customer.complement ?? undefined) : guestComplement || undefined,
        items: cart.map((i) => ({ productId: i.product.id, qty: i.qty, addonIds: i.addonIds })),
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

  function itemUnitPriceCents(item: CartItem) {
    return item.product.basePriceCents + item.addons.reduce((sum, a) => sum + a.priceCents, 0);
  }

  const subtotal = cart.reduce((sum, item) => sum + itemUnitPriceCents(item) * item.qty, 0);
  const total = subtotal + deliveryCents;
  const cashGivenCents = paymentMethod === "CASH" ? Math.round(parseFloat(cashGiven || "0") * 100) : 0;
  const change = cashGivenCents - total;

  const effectiveName = customer ? customer.name : guestName;
  const effectivePhone = customer ? customer.phone : guestPhone || (guestCpf ? `CPF ${guestCpf}` : "");

  function addToCart(product: ProductListItem, qty = 1, addonIds: string[] = [], addons: ProductAddon[] = []) {
    const key = buildCartKey(product.id, addonIds);
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i));
      return [
        ...prev,
        {
          key,
          qty,
          product: {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            basePriceCents: product.priceCents,
          },
          addonIds,
          addons,
        },
      ];
    });
  }

  function setQty(itemKey: string, qty: number) {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.key !== itemKey));
    else setCart((prev) => prev.map((i) => (i.key === itemKey ? { ...i, qty } : i)));
  }

  function openConfig(product: ProductListItem, existing?: CartItem) {
    setConfiguringProductId(product.id);
    setConfigQty(existing?.qty ?? 1);
    setConfigSelectedAddonIds(existing?.addonIds ?? []);
    setEditingCartKey(existing?.key ?? null);
  }

  function closeConfig() {
    setConfiguringProductId(null);
    setConfigQty(1);
    setConfigSelectedAddonIds([]);
    setEditingCartKey(null);
  }

  function confirmProductConfig() {
    if (!configuringProduct) return;
    const activeAddons = (configuringProduct.addons ?? []).filter((a) => a.isActive);
    const selected = activeAddons.filter((a) => configSelectedAddonIds.includes(a.id));
    const addonIds = selected.map((a) => a.id);
    const key = buildCartKey(configuringProduct.id, addonIds);

    setCart((prev) => {
      const withoutEdited = editingCartKey ? prev.filter((i) => i.key !== editingCartKey) : prev;
      const existing = withoutEdited.find((i) => i.key === key);
      if (existing) {
        return withoutEdited.map((i) => (i.key === key ? { ...i, qty: i.qty + Math.max(1, configQty) } : i));
      }
      return [
        ...withoutEdited,
        {
          key,
          qty: Math.max(1, configQty),
          product: {
            id: configuringProduct.id,
            name: configuringProduct.name,
            imageUrl: configuringProduct.images?.[0]?.url ?? null,
            basePriceCents: configuringProduct.priceCents,
          },
          addonIds,
          addons: selected,
        },
      ];
    });
    closeConfig();
  }

  function handleLookup() {
    const cleaned = lookupInput.replace(/\D/g, "");
    if (cleaned.length < 8) return;
    const isCpf = cleaned.length === 11;
    setGuestPhone(isCpf ? "" : cleaned);
    setGuestCpf(isCpf ? cleaned : "");
    setLookupValue(cleaned);
  }

  function goNext() {
    const idx = stepIndex(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function goPrev() {
    const idx = stepIndex(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  function resetFlow() {
    setStep("search");
    setSearchMode("lookup");
    setLookupInput("");
    setLookupValue("");
    setCustomer(null);
    setGuestName("");
    setGuestPhone("");
    setGuestCpf("");
    setGuestCep("");
    setGuestAddress("");
    setGuestComplement("");
    setCart([]);
    setPaymentMethod("PIX");
    setCashGiven("");
    setDeliveryCents(0);
    setConfirmedOrderId(null);
    setConfirmedOrderNumber(null);
    closeConfig();
  }

  function continueFromSearch() {
    if (foundCustomer && !lookupError) {
      setCustomer(foundCustomer);
    } else {
      setCustomer(null);
      const isCpf = lookupValue.length === 11;
      setGuestPhone(isCpf ? "" : lookupValue);
      setGuestCpf(isCpf ? lookupValue : "");
    }
    setShowRegisterForm(false);
    setStep("cart");
  }

  async function handleRegisterAndContinue() {
    if (!guestName.trim()) return;
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const created = await createCustomer({
        name:  guestName.trim(),
        phone: guestPhone.trim() || undefined,
        cpf:   guestCpf.trim()   || undefined,
      });
      setCustomer(created);
      setShowRegisterForm(false);
      setStep("cart");
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : "Erro ao cadastrar cliente.");
    } finally {
      setRegisterLoading(false);
    }
  }

  function continueQuickGuest() {
    if (!guestName.trim()) return;
    setCustomer(null);
    setLookupInput("");
    setLookupValue("");
    setGuestPhone("");
    setGuestCpf("");
    setStep("cart");
  }

  const canProceed: Record<Step, boolean> = {
    search: !!lookupValue,
    customer: true,
    cart: cart.length > 0,
    payment: paymentMethod !== "CASH" || (cashGivenCents >= total && total > 0),
    summary: false,
  };

  const stepTitles: Record<Step, string> = {
    search: "Identificar cliente",
    customer: "Dados do cliente",
    cart: "Montar carrinho",
    payment: "Pagamento",
    summary: confirmedOrderId ? "Pedido confirmado" : "Resumo do orçamento",
  };

  const isSuccessScreen = step === "summary" && !!confirmedOrderId;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (stepIndex(step) > 0 && !isSuccessScreen ? goPrev() : navigate("/app/atendimento"))}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[--surface-2] transition"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>{stepTitles[step]}</h1>
            {!isSuccessScreen && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Etapa {stepIndex(step) + 1} de {STEPS.length}
              </p>
            )}
          </div>
        </div>

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

        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          {step === "search" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSearchMode("lookup")}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition ${searchMode === "lookup" ? "bg-brand text-white border-brand" : "hover:bg-[--surface-2]"}`}
                  style={searchMode === "lookup" ? {} : { borderColor: "var(--border)", color: "var(--text)" }}
                >
                  Cliente cadastrado
                </button>
                <button
                  onClick={() => setSearchMode("quick")}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition ${searchMode === "quick" ? "bg-brand text-white border-brand" : "hover:bg-[--surface-2]"}`}
                  style={searchMode === "quick" ? {} : { borderColor: "var(--border)", color: "var(--text)" }}
                >
                  Pedido sem cadastro
                </button>
              </div>

              {searchMode === "lookup" ? (
                <>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Digite o telefone ou CPF do cliente para iniciar o atendimento.
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                      <input
                        type="tel"
                        value={lookupInput}
                        onChange={(e) => setLookupInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                        placeholder="Telefone ou CPF"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                        autoFocus
                      />
                    </div>
                    <button onClick={handleLookup} className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition flex items-center gap-2">
                      {searchingCustomer ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                      Buscar
                    </button>
                  </div>

                  {lookupValue && !searchingCustomer && (
                    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                      {foundCustomer ? (
                        <>
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 size={16} />
                            <span className="text-sm font-semibold">Cliente encontrado</span>
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: "var(--text)" }}>{foundCustomer.name}</p>
                            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{foundCustomer.phone || foundCustomer.cpf || "—"}</p>
                            {foundCustomer.address && (
                              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                <MapPin size={12} /> {foundCustomer.address}
                              </p>
                            )}
                          </div>
                          <button onClick={continueFromSearch} className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition">
                            Confirmar e montar pedido
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                            <User size={16} />
                            <span className="text-sm">Cliente não encontrado.</span>
                          </div>
                          <div className="space-y-2">
                            <input
                              value={guestName}
                              onChange={(e) => setGuestName(e.target.value)}
                              placeholder="Nome *"
                              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                placeholder="Telefone"
                                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                              />
                              <input
                                value={guestCpf}
                                onChange={(e) => setGuestCpf(e.target.value)}
                                placeholder="CPF"
                                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                              />
                            </div>
                          </div>
                          {registerError && <p className="text-xs text-red-500">{registerError}</p>}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              disabled={!guestName.trim() || registerLoading}
                              onClick={handleRegisterAndContinue}
                              className="py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition text-white"
                              style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
                            >
                              {registerLoading ? "Cadastrando…" : "Cadastrar e continuar"}
                            </button>
                            <button
                              disabled={!guestName.trim()}
                              onClick={continueFromSearch}
                              className="py-2.5 rounded-xl border text-sm font-semibold hover:bg-[var(--surface)] disabled:opacity-50 transition"
                              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                            >
                              Só desta vez
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Informe somente o nome para iniciar o pedido agora.
                  </p>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && continueQuickGuest()}
                    placeholder="Nome do cliente *"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                  />
                  <button
                    disabled={!guestName.trim()}
                    onClick={continueQuickGuest}
                    className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
                  >
                    Ir para produtos
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "customer" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Confirme os dados antes de continuar.</p>
              <Row label="Nome" value={effectiveName} />
              <Row label="Contato" value={effectivePhone} />
              {(customer?.address || guestAddress) && <Row label="Endereço" value={customer?.address ?? guestAddress} />}
            </div>
          )}

          {step === "cart" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface)" }}>
                <User size={14} style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{effectiveName}</span>
                <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{effectivePhone || "Sem contato"}</span>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar por nome, código interno ou código de barras"
                  className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
                <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Catálogo de produtos</h3>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{filteredProducts.length} itens</span>
                  </div>
                  {loadingProducts ? (
                    <div className="h-56 flex items-center justify-center">
                      <Loader2 className="animate-spin" size={18} style={{ color: "var(--text-muted)" }} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[520px] overflow-y-auto pr-1">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => (p.hasAddons ? openConfig(p) : addToCart(p))}
                          className="text-left rounded-xl border p-2 hover:border-brand/40 transition"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>Sem foto</div>
                            )}
                          </div>
                          <p className="mt-2 text-xs font-semibold line-clamp-2 min-h-[2rem]" style={{ color: "var(--text)" }}>{p.name}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-sm font-bold text-brand">{formatCents(p.priceCents)}</span>
                            <span className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center text-brand"><Plus size={13} /></span>
                          </div>
                          {p.isBestSeller && (
                            <span className="mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              Mais vendido
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border p-3 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Carrinho ({cart.reduce((sum, i) => sum + i.qty, 0)})
                  </h3>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {cart.map((item) => {
                      const unit = itemUnitPriceCents(item);
                      return (
                        <div key={item.key} className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}>
                          <div className="flex items-start gap-2">
                            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "var(--surface-2)" }}>
                              {item.product.imageUrl ? (
                                <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" />
                              ) : (
                                <div className="w-full h-full text-[10px] flex items-center justify-center" style={{ color: "var(--text-muted)" }}>img</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold line-clamp-2" style={{ color: "var(--text)" }}>{item.product.name}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatCents(unit)} un.</p>
                            </div>
                            <button onClick={() => setQty(item.key, 0)} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
                          </div>

                          {item.addons.length > 0 && (
                            <div className="text-xs space-y-1">
                              {item.addons.map((addon) => (
                                <div key={addon.id} className="flex justify-between" style={{ color: "var(--text-muted)" }}>
                                  <span className="inline-flex items-center gap-1"><Tag size={11} />{addon.name}</span>
                                  <span>+{formatCents(addon.priceCents)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setQty(item.key, item.qty - 1)} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: "var(--border)" }}>
                                <Minus size={13} />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold" style={{ color: "var(--text)" }}>{item.qty}</span>
                              <button onClick={() => setQty(item.key, item.qty + 1)} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: "var(--border)" }}>
                                <Plus size={13} />
                              </button>
                            </div>
                            <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{formatCents(unit * item.qty)}</span>
                          </div>

                          <button
                            onClick={() => openConfig(toPseudoProduct(item), item)}
                            className="w-full py-1.5 rounded-lg text-xs font-semibold border hover:bg-[--surface-2] transition"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                          >
                            <span className="inline-flex items-center gap-1"><Pencil size={12} />Editar adicionais</span>
                          </button>
                        </div>
                      );
                    })}

                    {cart.length === 0 && (
                      <div className="h-28 rounded-xl border border-dashed flex items-center justify-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                        Adicione produtos para continuar.
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                    <span>Subtotal</span>
                    <span>{formatCents(subtotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "payment" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Forma de pagamento</label>
                <div className="flex gap-2">
                  {["PIX", "CARD", "CASH"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition ${paymentMethod === m ? "bg-brand text-white border-brand" : "hover:bg-[--surface-2]"}`}
                      style={paymentMethod === m ? {} : { borderColor: "var(--border)", color: "var(--text)" }}
                    >
                      {m === "PIX" ? "Pix" : m === "CARD" ? "Cartão" : "Dinheiro"}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "CASH" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Valor em dinheiro (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    placeholder={`Mín. ${formatCents(total)}`}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                  />
                  {cashGivenCents > 0 && cashGivenCents >= total && <p className="text-sm text-green-600 font-semibold">Troco: {formatCents(change)}</p>}
                  {cashGivenCents > 0 && cashGivenCents < total && <p className="text-sm text-red-500">Valor insuficiente. Faltam {formatCents(total - cashGivenCents)}.</p>}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Taxa de entrega (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryCents > 0 ? (deliveryCents / 100).toFixed(2) : ""}
                  onChange={(e) => setDeliveryCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                  placeholder="0,00"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
              </div>

              <Section title="Totais">
                <Row label="Subtotal" value={formatCents(subtotal)} />
                <Row label="Entrega" value={formatCents(deliveryCents)} />
                <Row label="Total" value={formatCents(total)} bold />
              </Section>
            </div>
          )}

          {step === "summary" && !confirmedOrderId && (
            <div className="space-y-4">
              {submitError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{submitError}</div>}

              <Section title="Cliente">
                <Row label="Nome" value={effectiveName} />
                <Row label="Contato" value={effectivePhone} />
                {(customer?.address || guestAddress) && <Row label="Endereço" value={customer?.address ?? guestAddress} />}
              </Section>

              <Section title="Itens">
                {cart.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <Row label={`${item.qty}x ${item.product.name}`} value={formatCents(itemUnitPriceCents(item) * item.qty)} />
                    {item.addons.map((addon) => (
                      <Row key={addon.id} label={`+ ${addon.name}`} value={formatCents(addon.priceCents)} />
                    ))}
                  </div>
                ))}
              </Section>

              <Section title="Pagamento">
                <Row label="Forma" value={paymentMethodLabel(paymentMethod)} />
                <Row label="Subtotal" value={formatCents(subtotal)} />
                <Row label="Entrega" value={formatCents(deliveryCents)} />
                <Row label="Total" value={formatCents(total)} bold />
              </Section>

              <div className="flex gap-3 pt-2">
                <button onClick={() => navigate("/app/atendimento")} className="flex-1 py-3 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  Cancelar orçamento
                </button>
                <button
                  disabled={(paymentMethod === "CASH" && cashGivenCents < total) || confirmMut.isPending}
                  onClick={() => {
                    setSubmitError(null);
                    confirmMut.mutate();
                  }}
                  className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {confirmMut.isPending && <Loader2 size={16} className="animate-spin" />}
                  Confirmar pedido
                </button>
              </div>
            </div>
          )}

          {step === "summary" && confirmedOrderId && (
            <div className="text-center space-y-4 py-6">
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 size={36} className="text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: "var(--text)" }}>Pedido confirmado!</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{confirmedOrderNumber}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigate(`/app/pedidos/${confirmedOrderId}`)} className="flex-1 py-3 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  Ver pedido
                </button>
                <button onClick={resetFlow} className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition">
                  Novo atendimento
                </button>
              </div>
            </div>
          )}
        </div>

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

      {configuringProductId && (
        <ProductConfigModal
          product={configuringProduct}
          isLoading={loadingConfigProduct}
          qty={configQty}
          setQty={setConfigQty}
          selectedIds={configSelectedAddonIds}
          setSelectedIds={setConfigSelectedAddonIds}
          onClose={closeConfig}
          onConfirm={confirmProductConfig}
        />
      )}
    </div>
  );
}

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

function ProductConfigModal({
  product,
  isLoading,
  qty,
  setQty,
  selectedIds,
  setSelectedIds,
  onClose,
  onConfirm,
}: {
  product: ProductDetail | undefined;
  isLoading: boolean;
  qty: number;
  setQty: (v: number) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const addons = (product?.addons ?? []).filter((a) => a.isActive);
  const addonTotal = addons.filter((a) => selectedIds.includes(a.id)).reduce((sum, a) => sum + a.priceCents, 0);
  const totalUnit = (product?.priceCents ?? 0) + addonTotal;

  function toggle(addonId: string) {
    if (selectedIds.includes(addonId)) setSelectedIds(selectedIds.filter((id) => id !== addonId));
    else setSelectedIds([...selectedIds, addonId]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold" style={{ color: "var(--text)" }}>{product?.name ?? "Carregando..."}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Escolha os adicionais antes de incluir no carrinho.</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>

        {isLoading ? (
          <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin" size={18} /></div>
        ) : (
          <>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {addons.length > 0 ? (
                addons.map((addon) => (
                  <button
                    key={addon.id}
                    onClick={() => toggle(addon.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition ${selectedIds.includes(addon.id) ? "border-brand bg-brand/5" : ""}`}
                    style={selectedIds.includes(addon.id) ? {} : { borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <span>{addon.name}</span>
                    <span className="font-semibold text-brand">+{formatCents(addon.priceCents)}</span>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-3 text-sm text-center" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  Este produto não possui adicionais ativos.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Quantidade</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: "var(--border)" }}>
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-sm font-semibold" style={{ color: "var(--text)" }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: "var(--border)" }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </>
        )}

        <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: "var(--border)" }}>
          <Row label="Produto" value={formatCents(product?.priceCents ?? 0)} />
          <Row label="Adicionais" value={formatCents(addonTotal)} />
          <Row label="Total unitário" value={formatCents(totalUnit)} bold />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="py-2.5 rounded-xl border text-sm font-semibold hover:bg-[--surface-2]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Não, obrigado
          </button>
          <button onClick={onConfirm} className="py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110">
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
