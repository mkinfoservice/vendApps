import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchCustomerByPhoneOrCpf, createCustomer } from "@/features/admin/customers/api";
import type { CustomerDetailDto } from "@/features/admin/customers/types";
import { fetchAdminProductById, fetchAdminProducts } from "@/features/admin/products/api";
import type { ProductAddon, ProductDetail, ProductListItem } from "@/features/admin/products/api";
import { createPhoneOrder } from "@/features/admin/phoneOrder/api";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Coffee, Loader2, MapPin,
  Minus, Pencil, Phone, Plus, Search, ShoppingBag, Star,
  Tag, Trash2, User, X,
} from "lucide-react";

const GC = { bg: "#FAF7F2", cream: "#F5EDE0", brown: "#6B4F3A", dark: "#1C1209", caramel: "#C8953A" };

type Step = "search" | "customer" | "cart" | "payment" | "summary";
const STEPS: Step[] = ["search", "customer", "cart", "payment", "summary"];
type SearchMode = "lookup" | "quick";

type CartItem = {
  key: string; qty: number;
  product: { id: string; name: string; imageUrl: string | null; basePriceCents: number };
  addonIds: string[]; addons: ProductAddon[];
};

function stepIndex(step: Step) { return STEPS.indexOf(step); }
function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function buildCartKey(productId: string, addonIds: string[]) {
  return `${productId}::${[...addonIds].sort().join(",")}`;
}
function paymentMethodLabel(method: string) {
  if (method === "PIX") return "Pix"; if (method === "CARD") return "Cartão"; if (method === "CASH") return "Dinheiro"; return method;
}
function normalizeDavCode(code: string) {
  const normalized = code.trim().toUpperCase();
  return normalized.startsWith("DAV-") ? normalized : `DAV-${normalized}`;
}
function toPseudoProduct(item: CartItem): ProductListItem {
  return { id: item.product.id, name: item.product.name, imageUrl: item.product.imageUrl, priceCents: item.product.basePriceCents, hasAddons: true, isBestSeller: false, slug: "", internalCode: null, barcode: null, categoryName: null, brandName: null, unit: "UN", costCents: 0, marginPercent: 0, stockQty: 0, isActive: true, updatedAtUtc: null, promotionPriceCents: null };
}

// â”€â”€ Step pill indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STEP_LABELS = ["Cliente", "Dados", "Carrinho", "Pagamento", "Resumo"];
function StepBar({ current }: { current: Step }) {
  const idx = stepIndex(current);
  return (
    <div className="flex gap-1.5">
      {STEPS.map((s, i) => (
        <div key={s} className="flex-1 h-1.5 rounded-full transition-all"
          style={{ background: i <= idx ? `linear-gradient(90deg, ${GC.caramel}, #A87830)` : `rgba(107,79,58,0.15)` }} />
      ))}
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [configuringProductId, setConfiguringProductId] = useState<string | null>(null);
  const [configuringPromoPrice, setConfiguringPromoPrice] = useState<number | null>(null);
  const [configQty, setConfigQty] = useState(1);
  const [configSelectedAddonIds, setConfigSelectedAddonIds] = useState<string[]>([]);
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [cashGiven, setCashGiven] = useState("");
  const [deliveryCents, setDeliveryCents] = useState(0);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [confirmedDavId, setConfirmedDavId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: foundCustomer, isFetching: searchingCustomer, error: lookupError } = useQuery({
    queryKey: ["customer-by-phone-or-cpf", lookupValue],
    queryFn: () => fetchCustomerByPhoneOrCpf(lookupValue),
    enabled: lookupValue.length >= 8, retry: false,
  });
  const { data: productsData, isFetching: loadingProducts } = useQuery({
    queryKey: ["admin-products-phone-all"],
    queryFn: () => fetchAdminProducts({ active: true, excludeSupplies: true, pageSize: 300 }),
    enabled: step === "cart", placeholderData: (prev) => prev,
  });
  const { data: configuringProduct, isFetching: loadingConfigProduct } = useQuery({
    queryKey: ["admin-product-detail", configuringProductId],
    queryFn: () => fetchAdminProductById(configuringProductId!),
    enabled: !!configuringProductId,
  });

  const products = productsData?.items ?? [];
  const orderedProducts = useMemo(() => [...products].sort((a, b) => { if (a.isBestSeller !== b.isBestSeller) return a.isBestSeller ? -1 : 1; return a.name.localeCompare(b.name, "pt-BR"); }), [products]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.categoryName) set.add(p.categoryName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [products]);
  const filteredProducts = useMemo(() => {
    let result = orderedProducts;
    if (activeCategory) result = result.filter((p) => p.categoryName === activeCategory);
    const q = productSearch.trim().toLowerCase();
    if (!q) return result;
    return result.filter((p) => p.name.toLowerCase().includes(q) || (p.internalCode ?? "").toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q));
  }, [orderedProducts, productSearch, activeCategory]);

  const confirmMut = useMutation({
    mutationFn: () => {
      const cashGivenCents = paymentMethod === "CASH" ? Math.round(parseFloat(cashGiven || "0") * 100) : undefined;
      return createPhoneOrder({
        customerId: customer?.id, customerName: customer ? customer.name : guestName,
        customerPhone: customer ? customer.phone : guestPhone,
        cep: customer ? (customer.cep ?? undefined) : guestCep || undefined,
        address: customer ? (customer.address ?? undefined) : guestAddress || undefined,
        complement: customer ? (customer.complement ?? undefined) : guestComplement || undefined,
        items: cart.map((i) => ({ productId: i.product.id, qty: i.qty, addonIds: i.addonIds })),
        paymentMethod, deliveryCents: deliveryCents || 0, cashGivenCents,
      });
    },
    onSuccess: (data) => { setConfirmedOrderId(data.id); setConfirmedOrderNumber(data.orderNumber); setConfirmedDavId(data.davPublicId ?? null); setStep("summary"); },
    onError: async (e: unknown) => {
      const res = e as Response;
      const body = await res.json?.().catch(() => ({}));
      setSubmitError(body?.error ?? "Erro ao confirmar pedido.");
    },
  });

  function itemUnitPriceCents(item: CartItem) { return item.product.basePriceCents + item.addons.reduce((sum, a) => sum + a.priceCents, 0); }
  const subtotal = cart.reduce((sum, item) => sum + itemUnitPriceCents(item) * item.qty, 0);
  const total = subtotal + deliveryCents;
  const cashGivenCents = paymentMethod === "CASH" ? Math.round(parseFloat(cashGiven || "0") * 100) : 0;
  const change = cashGivenCents - total;
  const effectiveName = customer ? customer.name : guestName;
  const effectivePhone = customer ? customer.phone : guestPhone || (guestCpf ? `CPF ${guestCpf}` : "");

  function addToCart(product: ProductListItem, qty = 1, addonIds: string[] = [], addons: ProductAddon[] = []) {
    const key = buildCartKey(product.id, addonIds);
    const effectivePrice = product.promotionPriceCents ?? product.priceCents;
    setCart((prev) => { const existing = prev.find((i) => i.key === key); if (existing) return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i)); return [...prev, { key, qty, product: { id: product.id, name: product.name, imageUrl: product.imageUrl, basePriceCents: effectivePrice }, addonIds, addons }]; });
  }
  function setQty(itemKey: string, qty: number) { if (qty <= 0) setCart((prev) => prev.filter((i) => i.key !== itemKey)); else setCart((prev) => prev.map((i) => (i.key === itemKey ? { ...i, qty } : i))); }
  function openConfig(product: ProductListItem, existing?: CartItem) { setConfiguringProductId(product.id); setConfiguringPromoPrice(product.promotionPriceCents ?? null); setConfigQty(existing?.qty ?? 1); setConfigSelectedAddonIds(existing?.addonIds ?? []); setEditingCartKey(existing?.key ?? null); }
  function closeConfig() { setConfiguringProductId(null); setConfiguringPromoPrice(null); setConfigQty(1); setConfigSelectedAddonIds([]); setEditingCartKey(null); }
  function confirmProductConfig() {
    if (!configuringProduct) return;
    const activeAddons = (configuringProduct.addons ?? []).filter((a) => a.isActive);
    const selected = activeAddons.filter((a) => configSelectedAddonIds.includes(a.id));
    const addonIds = selected.map((a) => a.id);
    const key = buildCartKey(configuringProduct.id, addonIds);
    const basePrice = configuringPromoPrice ?? configuringProduct.priceCents;
    setCart((prev) => { const withoutEdited = editingCartKey ? prev.filter((i) => i.key !== editingCartKey) : prev; const existing = withoutEdited.find((i) => i.key === key); if (existing) return withoutEdited.map((i) => (i.key === key ? { ...i, qty: i.qty + Math.max(1, configQty) } : i)); return [...withoutEdited, { key, qty: Math.max(1, configQty), product: { id: configuringProduct.id, name: configuringProduct.name, imageUrl: configuringProduct.images?.[0]?.url ?? null, basePriceCents: basePrice }, addonIds, addons: selected }]; });
    closeConfig();
  }
  function handleLookup() { const cleaned = lookupInput.replace(/\D/g, ""); if (cleaned.length < 8) return; const isCpf = cleaned.length === 11; setGuestPhone(isCpf ? "" : cleaned); setGuestCpf(isCpf ? cleaned : ""); setLookupValue(cleaned); }
  function goNext() { const idx = stepIndex(step); if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]); }
  function goPrev() { const idx = stepIndex(step); if (idx > 0) setStep(STEPS[idx - 1]); }
  function resetFlow() {
    setStep("search"); setSearchMode("lookup"); setLookupInput(""); setLookupValue(""); setCustomer(null);
    setGuestName(""); setGuestPhone(""); setGuestCpf(""); setGuestCep(""); setGuestAddress(""); setGuestComplement("");
    setCart([]); setPaymentMethod("PIX"); setCashGiven(""); setDeliveryCents(0);
    setConfirmedOrderId(null); setConfirmedOrderNumber(null); setConfirmedDavId(null); closeConfig();
  }
  function continueFromSearch() { if (foundCustomer && !lookupError) setCustomer(foundCustomer); else { setCustomer(null); const isCpf = lookupValue.length === 11; setGuestPhone(isCpf ? "" : lookupValue); setGuestCpf(isCpf ? lookupValue : ""); } setStep("cart"); }
  async function handleRegisterAndContinue() {
    if (!guestName.trim()) return; setRegisterLoading(true); setRegisterError(null);
    try { const created = await createCustomer({ name: guestName.trim(), phone: guestPhone.trim() || undefined, cpf: guestCpf.trim() || undefined }); setCustomer(created); setStep("cart"); }
    catch (e) { setRegisterError(e instanceof Error ? e.message : "Erro ao cadastrar cliente."); }
    finally { setRegisterLoading(false); }
  }
  function continueQuickGuest() { if (!guestName.trim()) return; setCustomer(null); setLookupInput(""); setLookupValue(""); setGuestPhone(""); setGuestCpf(""); setStep("cart"); }

  const canProceed: Record<Step, boolean> = {
    search: !!lookupValue, customer: true, cart: cart.length > 0,
    payment: paymentMethod !== "CASH" || (cashGivenCents >= total && total > 0), summary: false,
  };

  const stepTitles: Record<Step, string> = {
    search: "Identificar cliente", customer: "Dados do cliente", cart: "Montar carrinho",
    payment: "Pagamento", summary: confirmedOrderId ? "Pedido confirmado" : "Resumo do orçamento",
  };
  const isSuccessScreen = step === "summary" && !!confirmedOrderId;

  // â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isSuccessScreen) {
    const davForPdv = confirmedDavId ? normalizeDavCode(confirmedDavId) : null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ background: GC.bg }}>
        <div className="w-full max-w-sm space-y-6">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto"
            style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 8px 32px rgba(28,18,9,0.25)" }}>
            <CheckCircle2 size={44} style={{ color: GC.caramel }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black" style={{ color: GC.dark }}>Pedido confirmado!</h2>
            <p style={{ color: GC.brown, opacity: 0.7 }}>
              Atendimento de <strong style={{ color: GC.dark }}>{effectiveName.split(" ")[0]}</strong> registrado.
            </p>
            <div className="inline-block px-5 py-2.5 rounded-2xl mt-2"
              style={{ background: `${GC.caramel}18`, color: GC.caramel }}>
              <span className="text-xs font-semibold block">Número do pedido</span>
              <span className="text-xl font-black">{confirmedOrderNumber}</span>
            </div>
            {confirmedDavId && (
              <div className="px-5 py-3 rounded-2xl mt-2"
                style={{ background: "linear-gradient(135deg, #059669, #047857)", color: "#fff" }}>
                <span className="text-xs font-semibold block opacity-80">Código DAV para o caixa</span>
                <span className="text-2xl font-black tracking-widest">{confirmedDavId}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button onClick={() => navigate(`/app/pedidos/${confirmedOrderId}`)}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition active:scale-[0.98]"
              style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
              Ver pedido
            </button>
            {davForPdv && (
              <button
                onClick={() => navigate(`/pdv?dav=${encodeURIComponent(davForPdv)}&autoImport=1`)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white transition active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #059669, #047857)", boxShadow: "0 4px 18px rgba(4,120,87,0.25)" }}>
                Ir para caixa
              </button>
            )}
            <button onClick={resetFlow}
              className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white transition active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 18px rgba(28,18,9,0.3)" }}>
              Novo atendimento
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: GC.bg }}>
      {/* â”€â”€ Top bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-4"
        style={{ background: GC.bg, borderBottom: `1px solid rgba(107,79,58,0.1)` }}>
        <button onClick={() => (stepIndex(step) > 0 ? goPrev() : navigate("/app/atendimento"))}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition active:scale-90 shrink-0"
          style={{ background: GC.cream, color: GC.brown }}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-base leading-tight" style={{ color: GC.dark }}>{stepTitles[step]}</p>
          <p className="text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>
            Etapa {stepIndex(step) + 1} de {STEPS.length} · {STEP_LABELS[stepIndex(step)]}
          </p>
        </div>
        {cart.length > 0 && step !== "cart" && step !== "summary" && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
            style={{ background: `${GC.caramel}18` }}>
            <ShoppingBag size={13} style={{ color: GC.caramel }} />
            <span className="text-xs font-black" style={{ color: GC.caramel }}>{cart.reduce((s, i) => s + i.qty, 0)}</span>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-4 pb-24">
        {/* Step bar */}
        <div className="mb-6">
          <StepBar current={step} />
        </div>

        {/* â”€â”€ STEP: search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === "search" && (
          <div className="max-w-lg mx-auto space-y-4">
            {/* Hero */}
            <div className="rounded-3xl p-6 text-center"
              style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 8px 32px rgba(28,18,9,0.25)" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(200,149,58,0.2)" }}>
                <Coffee size={28} style={{ color: GC.caramel }} />
              </div>
              <h2 className="text-xl font-black text-white mb-1">Novo Atendimento</h2>
              <p className="text-sm" style={{ color: "rgba(245,237,224,0.6)" }}>
                Busque o cliente ou inicie sem cadastro
              </p>
            </div>

            {/* Tab toggle */}
            <div className="rounded-2xl p-1 flex gap-1" style={{ background: GC.cream }}>
              {(["lookup", "quick"] as SearchMode[]).map((m) => (
                <button key={m} onClick={() => setSearchMode(m)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={searchMode === m
                    ? { background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, color: "#fff" }
                    : { color: GC.brown, opacity: 0.65 }}>
                  {m === "lookup" ? "Cliente cadastrado" : "Sem cadastro"}
                </button>
              ))}
            </div>

            {/* Lookup mode */}
            {searchMode === "lookup" && (
              <div className="rounded-3xl p-5 space-y-4" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
                <p className="text-sm" style={{ color: GC.brown, opacity: 0.7 }}>
                  Digite o telefone ou CPF do cliente.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: GC.brown, opacity: 0.5 }} />
                    <input type="tel" value={lookupInput}
                      onChange={(e) => setLookupInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      placeholder="Telefone ou CPF" autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm focus:outline-none"
                      style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: GC.bg, color: GC.dark }} />
                  </div>
                  <button onClick={handleLookup}
                    className="px-5 py-3 rounded-2xl text-sm font-black text-white flex items-center gap-2 transition active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
                    {searchingCustomer ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    Buscar
                  </button>
                </div>

                {lookupValue && !searchingCustomer && (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: GC.bg, border: `1.5px solid rgba(107,79,58,0.1)` }}>
                    {foundCustomer ? (
                      <>
                        <div className="flex items-center gap-2" style={{ color: "#059669" }}>
                          <CheckCircle2 size={16} />
                          <span className="text-sm font-bold">Cliente encontrado</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white"
                            style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
                            {foundCustomer.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold" style={{ color: GC.dark }}>{foundCustomer.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.65 }}>{foundCustomer.phone || foundCustomer.cpf || "—"}</p>
                            {foundCustomer.address && (
                              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: GC.brown, opacity: 0.5 }}>
                                <MapPin size={11} />{foundCustomer.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <button onClick={continueFromSearch}
                          className="w-full py-3 rounded-2xl font-black text-sm text-white transition active:scale-[0.98]"
                          style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 16px rgba(28,18,9,0.25)" }}>
                          Confirmar e montar pedido →
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2" style={{ color: GC.brown, opacity: 0.65 }}>
                          <User size={16} />
                          <span className="text-sm">Cliente não encontrado. Cadastre abaixo:</span>
                        </div>
                        <div className="space-y-2">
                          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nome *"
                            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                            style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: GC.bg, color: GC.dark }} />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Telefone"
                              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: GC.bg, color: GC.dark }} />
                            <input value={guestCpf} onChange={(e) => setGuestCpf(e.target.value)} placeholder="CPF"
                              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                              style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: GC.bg, color: GC.dark }} />
                          </div>
                        </div>
                        {registerError && <p className="text-xs text-red-500">{registerError}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <button disabled={!guestName.trim() || registerLoading} onClick={handleRegisterAndContinue}
                            className="py-3 rounded-2xl text-sm font-black text-white disabled:opacity-50 transition active:scale-95"
                            style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
                            {registerLoading ? "Cadastrando..." : "Cadastrar e continuar"}
                          </button>
                          <button disabled={!guestName.trim()} onClick={continueFromSearch}
                            className="py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 transition active:scale-95"
                            style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
                            Só desta vez
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick guest mode */}
            {searchMode === "quick" && (
              <div className="rounded-3xl p-5 space-y-4" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
                <p className="text-sm" style={{ color: GC.brown, opacity: 0.7 }}>
                  Informe o nome para iniciar o pedido agora.
                </p>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && continueQuickGuest()}
                  placeholder="Nome do cliente *" autoFocus
                  className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none"
                  style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: GC.bg, color: GC.dark }} />
                <button disabled={!guestName.trim()} onClick={continueQuickGuest}
                  className="w-full py-3 rounded-2xl font-black text-sm text-white disabled:opacity-50 transition active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 16px rgba(28,18,9,0.25)" }}>
                  Ir para produtos →
                </button>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ STEP: customer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === "customer" && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-3xl p-6 space-y-4" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shrink-0"
                  style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
                  {effectiveName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-lg" style={{ color: GC.dark }}>{effectiveName}</p>
                  <p className="text-sm mt-0.5" style={{ color: GC.brown, opacity: 0.65 }}>{effectivePhone || "Sem contato"}</p>
                  {(customer?.address || guestAddress) && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: GC.brown, opacity: 0.5 }}>
                      <MapPin size={11} />{customer?.address ?? guestAddress}
                    </p>
                  )}
                </div>
              </div>
              {customer && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: `${GC.caramel}12` }}>
                  <Star size={13} style={{ color: GC.caramel }} className="fill-current" />
                  <span className="text-xs font-semibold" style={{ color: GC.caramel }}>
                    {(customer as any).points ?? 0} pontos de fidelidade
                  </span>
                </div>
              )}
              <button onClick={goNext}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 16px rgba(28,18,9,0.25)" }}>
                Montar carrinho <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP: cart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === "cart" && (
          <div className="space-y-4">
            {/* Customer tag */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "#fff", boxShadow: "0 2px 12px rgba(28,18,9,0.06)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
                {effectiveName.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: GC.dark }}>{effectiveName}</p>
                <p className="text-xs" style={{ color: GC.brown, opacity: 0.55 }}>{effectivePhone || "Sem contato"}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${GC.caramel}15`, color: GC.caramel }}>
                {cart.reduce((s, i) => s + i.qty, 0)} iten(s)
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: GC.brown, opacity: 0.45 }} />
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto, código ou barras..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none"
                style={{ background: "#fff", border: `1.5px solid rgba(107,79,58,0.12)`, color: GC.dark, boxShadow: "0 2px 8px rgba(28,18,9,0.05)" }} />
            </div>

            {/* Category pills */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                <button
                  onClick={() => setActiveCategory(null)}
                  className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                  style={!activeCategory
                    ? { background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, color: "#fff" }
                    : { background: GC.cream, color: GC.brown, border: `1.5px solid rgba(107,79,58,0.15)` }}>
                  Todos
                </button>
                {categories.map((cat) => (
                  <button key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                    style={activeCategory === cat
                      ? { background: `linear-gradient(135deg, ${GC.caramel}, #A87830)`, color: "#fff" }
                      : { background: GC.cream, color: GC.brown, border: `1.5px solid rgba(107,79,58,0.15)` }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              {/* Product grid */}
              <div className="rounded-3xl p-4" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.07)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase tracking-widest" style={{ color: GC.brown, opacity: 0.6 }}>Catálogo</p>
                  <span className="text-xs" style={{ color: GC.brown, opacity: 0.45 }}>{filteredProducts.length} itens</span>
                </div>
                {loadingProducts ? (
                  <div className="h-56 flex items-center justify-center">
                    <Loader2 className="animate-spin" size={20} style={{ color: GC.caramel }} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
                    {filteredProducts.map((p) => (
                      <button key={p.id}
                        onClick={() => (p.hasAddons ? openConfig(p) : addToCart(p))}
                        className="text-left rounded-2xl p-2.5 transition-all active:scale-95 hover:-translate-y-0.5"
                        style={{ border: `1.5px solid rgba(107,79,58,0.1)`, background: GC.bg }}>
                        <div className="aspect-square rounded-xl overflow-hidden mb-2" style={{ background: GC.cream }}>
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Coffee size={20} style={{ color: GC.brown, opacity: 0.3 }} /></div>}
                        </div>
                        <p className="text-xs font-semibold line-clamp-2 min-h-[2rem]" style={{ color: GC.dark }}>{p.name}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          <div className="flex flex-col min-w-0">
                            {p.promotionPriceCents !== null ? (
                              <>
                                <span className="text-[10px] line-through" style={{ color: GC.brown, opacity: 0.5 }}>{formatCents(p.priceCents)}</span>
                                <span className="text-sm font-black" style={{ color: "#059669" }}>{formatCents(p.promotionPriceCents)}</span>
                              </>
                            ) : (
                              <span className="text-sm font-black" style={{ color: GC.caramel }}>{formatCents(p.priceCents)}</span>
                            )}
                          </div>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${GC.caramel}18`, color: GC.caramel }}>
                            <Plus size={12} />
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.promotionPriceCents !== null && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: "rgba(5,150,105,0.12)", color: "#059669" }}>
                              % Promo
                            </span>
                          )}
                          {p.isBestSeller && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: `${GC.caramel}15`, color: GC.caramel }}>
                              <Star size={9} className="fill-current" /> Top
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart panel */}
              <div className="rounded-3xl p-4 space-y-3" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.07)" }}>
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: GC.brown, opacity: 0.6 }}>
                  Carrinho ({cart.reduce((s, i) => s + i.qty, 0)})
                </p>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {cart.map((item) => {
                    const unit = itemUnitPriceCents(item);
                    return (
                      <div key={item.key} className="rounded-2xl p-3 space-y-2"
                        style={{ border: `1.5px solid rgba(107,79,58,0.1)`, background: GC.bg }}>
                        <div className="flex items-start gap-2.5">
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0" style={{ background: GC.cream }}>
                            {item.product.imageUrl
                              ? <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Coffee size={14} style={{ color: GC.brown, opacity: 0.3 }} /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold line-clamp-2" style={{ color: GC.dark }}>{item.product.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>{formatCents(unit)} un.</p>
                          </div>
                          <button onClick={() => setQty(item.key, 0)} style={{ color: "rgba(239,68,68,0.7)" }}><Trash2 size={13} /></button>
                        </div>
                        {item.addons.length > 0 && (
                          <div className="text-xs space-y-0.5">
                            {item.addons.map((a) => (
                              <div key={a.id} className="flex justify-between" style={{ color: GC.caramel }}>
                                <span className="flex items-center gap-1"><Tag size={10} />{a.name}</span>
                                <span>+{formatCents(a.priceCents)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setQty(item.key, item.qty - 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90"
                              style={{ border: `1.5px solid rgba(107,79,58,0.18)`, color: GC.brown }}>
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center text-sm font-black" style={{ color: GC.dark }}>{item.qty}</span>
                            <button onClick={() => setQty(item.key, item.qty + 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90"
                              style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
                              <Plus size={12} className="text-white" />
                            </button>
                          </div>
                          <span className="text-sm font-black" style={{ color: GC.dark }}>{formatCents(unit * item.qty)}</span>
                        </div>
                        <button onClick={() => openConfig(toPseudoProduct(item), item)}
                          className="w-full py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
                          style={{ border: `1.5px solid rgba(107,79,58,0.12)`, color: GC.brown }}>
                          <Pencil size={11} /> Editar adicionais
                        </button>
                      </div>
                    );
                  })}
                  {cart.length === 0 && (
                    <div className="h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2"
                      style={{ borderColor: "rgba(107,79,58,0.15)" }}>
                      <ShoppingBag size={24} style={{ color: GC.brown, opacity: 0.2 }} />
                      <p className="text-sm" style={{ color: GC.brown, opacity: 0.4 }}>Adicione produtos</p>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t flex justify-between text-sm font-black" style={{ borderColor: "rgba(107,79,58,0.12)", color: GC.dark }}>
                  <span>Subtotal</span><span style={{ color: GC.caramel }}>{formatCents(subtotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP: payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === "payment" && (
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <div className="rounded-3xl p-5 space-y-5" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: GC.brown, opacity: 0.6 }}>
                      Forma de pagamento
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[{ key: "PIX", label: "Pix" }, { key: "CARD", label: "Cartão" }, { key: "CASH", label: "Dinheiro" }].map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setPaymentMethod(m.key)}
                          className="py-3 rounded-2xl text-sm font-bold transition active:scale-95"
                          style={paymentMethod === m.key
                            ? { background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, color: "#fff" }
                            : { border: `1.5px solid rgba(107,79,58,0.15)`, color: GC.brown, background: GC.bg }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === "CASH" && (
                    <div>
                      <label className="text-xs font-black uppercase tracking-widest block mb-2" style={{ color: GC.brown, opacity: 0.6 }}>
                        Valor em dinheiro (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        placeholder={`Mín. ${formatCents(total)}`}
                        className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none"
                        style={{ border: `1.5px solid rgba(107,79,58,0.15)`, background: GC.bg, color: GC.dark }}
                      />
                      {cashGivenCents > 0 && cashGivenCents >= total && (
                        <p className="text-sm font-bold mt-2" style={{ color: "#059669" }}>Troco: {formatCents(change)}</p>
                      )}
                      {cashGivenCents > 0 && cashGivenCents < total && (
                        <p className="text-sm mt-2" style={{ color: "#dc2626" }}>Faltam {formatCents(total - cashGivenCents)}</p>
                      )}
                    </div>
                  )}

                  <div className="rounded-2xl p-4 space-y-2" style={{ background: GC.bg }}>
                    <div className="flex items-center justify-between text-sm" style={{ color: GC.brown }}>
                      <span>Subtotal</span>
                      <span className="font-bold">{formatCents(subtotal)}</span>
                    </div>
                    {deliveryCents > 0 && (
                      <div className="flex items-center justify-between text-sm" style={{ color: GC.brown }}>
                        <span>Entrega</span>
                        <span className="font-bold">{formatCents(deliveryCents)}</span>
                      </div>
                    )}
                    <div className="h-px" style={{ background: "rgba(107,79,58,0.12)" }} />
                    <div className="flex justify-between font-black" style={{ color: GC.dark }}>
                      <span>Total</span>
                      <span style={{ color: GC.caramel, fontSize: "1.1rem" }}>{formatCents(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={goNext}
                    disabled={!canProceed.payment}
                    className="w-full py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 transition active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 18px rgba(28,18,9,0.3)" }}
                  >
                    Ver resumo →
                  </button>
                </div>
              </div>

              <aside className="lg:col-span-2">
                <div className="rounded-3xl p-5 space-y-4 lg:sticky lg:top-24" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: GC.brown, opacity: 0.55 }}>
                      Resumo rápido
                    </p>
                    <p className="mt-2 text-sm font-bold" style={{ color: GC.dark }}>{effectiveName || "Sem nome"}</p>
                    {effectivePhone && <p className="text-xs" style={{ color: GC.brown, opacity: 0.65 }}>{effectivePhone}</p>}
                  </div>

                  <div className="space-y-2">
                    {cart.slice(0, 4).map((item) => (
                      <div key={item.key} className="flex items-start justify-between gap-2 text-sm">
                        <span className="line-clamp-2" style={{ color: GC.dark }}>{item.qty}× {item.product.name}</span>
                        <span className="font-bold shrink-0" style={{ color: GC.dark }}>{formatCents(itemUnitPriceCents(item) * item.qty)}</span>
                      </div>
                    ))}
                    {cart.length > 4 && (
                      <p className="text-xs" style={{ color: GC.brown, opacity: 0.65 }}>
                        +{cart.length - 4} item(ns)
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP: summary (pre-confirm) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === "summary" && !confirmedOrderId && (
          <div className="max-w-lg mx-auto space-y-4">
            {submitError && (
              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}>
                {submitError}
              </div>
            )}

            {/* Customer */}
            <div className="rounded-3xl p-5 space-y-3" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: GC.brown, opacity: 0.55 }}>Cliente</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
                  {effectiveName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold" style={{ color: GC.dark }}>{effectiveName}</p>
                  <p className="text-xs" style={{ color: GC.brown, opacity: 0.6 }}>{effectivePhone || "Sem contato"}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-3xl p-5 space-y-2" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: GC.brown, opacity: 0.55 }}>Itens</p>
              {cart.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold" style={{ color: GC.dark }}>{item.qty}× {item.product.name}</span>
                    <span className="font-bold" style={{ color: GC.dark }}>{formatCents(itemUnitPriceCents(item) * item.qty)}</span>
                  </div>
                  {item.addons.map((a) => (
                    <div key={a.id} className="flex justify-between text-xs pl-3" style={{ color: GC.caramel }}>
                      <span>+ {a.name}</span><span>+{formatCents(a.priceCents)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Payment summary */}
            <div className="rounded-3xl p-5 space-y-2" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: GC.brown, opacity: 0.55 }}>Pagamento</p>
              <div className="flex justify-between text-sm" style={{ color: GC.brown }}>
                <span>Forma</span><span>{paymentMethodLabel(paymentMethod)}</span>
              </div>
              <div className="flex justify-between pt-2 font-black" style={{ borderTop: `1px solid rgba(107,79,58,0.12)`, color: GC.dark }}>
                <span>Total</span><span style={{ color: GC.caramel, fontSize: "1.1rem" }}>{formatCents(total)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => navigate("/app/atendimento")}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition active:scale-[0.98]"
                style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
                Cancelar
              </button>
              <button
                disabled={(paymentMethod === "CASH" && cashGivenCents < total) || confirmMut.isPending}
                onClick={() => { setSubmitError(null); confirmMut.mutate(); }}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white disabled:opacity-50 transition active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 18px rgba(28,18,9,0.3)" }}>
                {confirmMut.isPending && <Loader2 size={16} className="animate-spin" />}
                Confirmar pedido
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ Next button (steps 2-4) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === "cart" && (
          <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
            style={{ background: `linear-gradient(to top, ${GC.bg} 70%, transparent)` }}>
            <div className="mx-auto max-w-4xl">
              <button onClick={goNext} disabled={!canProceed[step]}
                className="w-full py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 transition active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 18px rgba(28,18,9,0.3)" }}>
                Ir para pagamento <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Product config modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {configuringProductId && (
        <ProductConfigModal
          product={configuringProduct} isLoading={loadingConfigProduct}
          promoPrice={configuringPromoPrice}
          qty={configQty} setQty={setConfigQty}
          selectedIds={configSelectedAddonIds} setSelectedIds={setConfigSelectedAddonIds}
          onClose={closeConfig} onConfirm={confirmProductConfig}
        />
      )}
    </div>
  );
}

// â”€â”€ ProductConfigModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProductConfigModal({ product, isLoading, promoPrice, qty, setQty, selectedIds, setSelectedIds, onClose, onConfirm }: {
  product: ProductDetail | undefined; isLoading: boolean;
  promoPrice: number | null;
  qty: number; setQty: (v: number) => void;
  selectedIds: string[]; setSelectedIds: (ids: string[]) => void;
  onClose: () => void; onConfirm: () => void;
}) {
  const addons = (product?.addons ?? []).filter((a) => a.isActive);
  const addonTotal = addons.filter((a) => selectedIds.includes(a.id)).reduce((s, a) => s + a.priceCents, 0);
  const basePrice = promoPrice ?? (product?.priceCents ?? 0);
  const totalUnit = basePrice + addonTotal;

  function toggle(addonId: string) {
    if (selectedIds.includes(addonId)) setSelectedIds(selectedIds.filter((id) => id !== addonId));
    else setSelectedIds([...selectedIds, addonId]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(28,18,9,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-3xl p-5 space-y-4" style={{ background: "#fff", boxShadow: "0 16px 48px rgba(28,18,9,0.25)" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-black text-base" style={{ color: GC.dark }}>{product?.name ?? "Carregando..."}</p>
            <p className="text-xs mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>Escolha os adicionais</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: GC.cream, color: GC.brown }}>
            <X size={15} />
          </button>
        </div>

        {isLoading ? (
          <div className="h-20 flex items-center justify-center">
            <Loader2 className="animate-spin" size={20} style={{ color: GC.caramel }} />
          </div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {addons.length > 0 ? addons.map((addon) => {
              const sel = selectedIds.includes(addon.id);
              return (
              <button key={addon.id} onClick={() => toggle(addon.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition active:scale-[0.98]"
                style={sel
                  ? { background: `rgba(200,149,58,0.18)`, border: `2px solid ${GC.caramel}`, color: GC.dark }
                  : { border: `1.5px solid rgba(107,79,58,0.15)`, color: GC.dark, background: GC.bg }}>
                <div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all"
                  style={{ borderColor: sel ? GC.caramel : "rgba(107,79,58,0.3)", background: sel ? GC.caramel : "transparent" }}>
                  {sel && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                </div>
                <span className="flex-1 font-medium text-left">{addon.name}</span>
                <span className="font-black text-sm shrink-0" style={{ color: GC.caramel }}>+{formatCents(addon.priceCents)}</span>
              </button>
              );
            }) : (
              <div className="rounded-2xl border-2 border-dashed p-4 text-sm text-center"
                style={{ borderColor: "rgba(107,79,58,0.15)", color: GC.brown, opacity: 0.5 }}>
                Sem adicionais
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: GC.bg }}>
          <span className="text-sm font-semibold" style={{ color: GC.brown }}>Quantidade</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ border: `1.5px solid rgba(107,79,58,0.18)`, color: GC.brown }}>
              <Minus size={13} />
            </button>
            <span className="w-6 text-center font-black" style={{ color: GC.dark }}>{qty}</span>
            <button onClick={() => setQty(qty + 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)` }}>
              <Plus size={13} className="text-white" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl p-3 space-y-1.5" style={{ background: GC.bg }}>
          <div className="flex justify-between text-sm" style={{ color: GC.brown }}>
            <span>Produto</span>
            <span className="flex items-center gap-1.5">
              {promoPrice !== null && product && (
                <span className="text-xs line-through opacity-50">{formatCents(product.priceCents)}</span>
              )}
              <span style={promoPrice !== null ? { color: "#059669", fontWeight: 700 } : undefined}>
                {formatCents(basePrice)}
              </span>
            </span>
          </div>
          <div className="flex justify-between text-sm" style={{ color: GC.brown }}>
            <span>Adicionais</span><span>{formatCents(addonTotal)}</span>
          </div>
          <div className="flex justify-between font-black pt-1" style={{ borderTop: `1px solid rgba(107,79,58,0.1)`, color: GC.dark }}>
            <span>Total unitário</span><span style={{ color: GC.caramel }}>{formatCents(totalUnit)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose}
            className="py-3 rounded-2xl text-sm font-semibold transition active:scale-95"
            style={{ border: `1.5px solid rgba(107,79,58,0.2)`, color: GC.brown, background: GC.cream }}>
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="py-3 rounded-2xl text-sm font-black text-white transition active:scale-95"
            style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 14px rgba(28,18,9,0.25)" }}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
