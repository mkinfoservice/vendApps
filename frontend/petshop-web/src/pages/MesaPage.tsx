import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart, Plus, Minus, Trash2, Search, X,
  CheckCircle2, Star, ChevronLeft, UtensilsCrossed,
} from "lucide-react";
import type { Category, Product, StoreFrontConfig } from "@/features/catalog/api";
import { CreateOrder } from "@/features/orders/api";

// ── Catalog helpers com slug explícito ────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

async function fetchTableInfo(tableId: string): Promise<{ slug: string; number: number; name: string | null }> {
  const r = await fetch(`${API_URL}/public/tables/${tableId}`);
  if (!r.ok) throw new Error("Mesa não encontrada");
  return r.json();
}

function makeCatalogApi(slug: string) {
  const base = `${API_URL}/catalog/${slug}`;
  return {
    storefront: (): Promise<StoreFrontConfig> => fetch(`${base}/storefront`).then(r => r.json()),
    categories: (): Promise<Category[]>      => fetch(`${base}/categories`).then(r => r.json()),
    products:   (catSlug?: string, search?: string): Promise<Product[]> => {
      const p = new URLSearchParams();
      if (catSlug) p.set("categorySlug", catSlug);
      if (search)  p.set("search", search);
      const qs = p.toString();
      return fetch(`${base}/products${qs ? `?${qs}` : ""}`).then(r => r.json());
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

// ── Cart ───────────────────────────────────────────────────────────────────────

type CartItem = { product: Product; qty: number };

function useLocalCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  function add(product: Product) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) return prev.map((i, k) => k === idx ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  }

  function inc(id: string) {
    setItems(prev => prev.map(i => i.product.id === id ? { ...i, qty: i.qty + 1 } : i));
  }

  function dec(id: string) {
    setItems(prev => {
      const next = prev.map(i => i.product.id === id ? { ...i, qty: i.qty - 1 } : i);
      return next.filter(i => i.qty > 0);
    });
  }

  function remove(id: string) {
    setItems(prev => prev.filter(i => i.product.id !== id));
  }

  function clear() { setItems([]); }

  const totalCents   = items.reduce((s, i) => s + i.product.priceCents * i.qty, 0);
  const totalItems   = items.reduce((s, i) => s + i.qty, 0);

  return { items, add, inc, dec, remove, clear, totalCents, totalItems };
}

// ── Step 1: Nome ───────────────────────────────────────────────────────────────

function StepName({ brand, tableNum, onNext }: {
  brand: string;
  tableNum?: number;
  onNext: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}>
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">{brand}</h1>
          {tableNum && (
            <p className="text-sm text-gray-500 mt-1">Mesa {tableNum} · Auto-atendimento</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Olá! Qual é o seu nome?</h2>
            <p className="text-sm text-gray-500 mt-1">Para começarmos o pedido</p>
          </div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) onNext(name.trim()); }}
            placeholder="Seu nome"
            className="w-full h-12 rounded-xl border border-gray-200 px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={() => name.trim() && onNext(name.trim())}
            disabled={!name.trim()}
            className="w-full h-12 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Cadastro (opcional) ────────────────────────────────────────────────

function StepRegister({ name, onSkip, onRegister }: {
  name: string;
  onSkip: () => void;
  onRegister: (phone: string, cpf: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [cpf,   setCpf]   = useState("");

  function handleRegister() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    onRegister(digits, cpf.replace(/\D/g, ""));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-5">
        {/* Loyalty pitch */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Programa de Fidelidade</p>
              <p className="text-xs text-gray-500">Acumule pontos e troque por descontos</p>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">✦</span>
              A cada compra você ganha pontos
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">✦</span>
              Troque pontos por descontos ou itens grátis
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">✦</span>
              Quanto mais você compra, mais benefícios
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div>
            <p className="font-bold text-gray-900">Quer se cadastrar, {name.split(" ")[0]}?</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Se cadastre para participar do programa de fidelidade.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              CPF <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={phone.replace(/\D/g, "").length < 10}
            className="w-full h-11 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            Cadastrar e ganhar pontos
          </button>

          <button
            onClick={onSkip}
            className="w-full text-sm text-gray-500 hover:text-gray-800 transition py-1"
          >
            Agora não, só quero pedir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Card (mesa version) ────────────────────────────────────────────────

function MesaProductCard({ product, qty, onAdd, onInc, onDec }: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const originalPrice = product.discountPercent
    ? Math.round(product.priceCents / (1 - product.discountPercent / 100))
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {product.imageUrl ? (
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {product.discountPercent ? (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              -{product.discountPercent}%
            </span>
          ) : null}
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          <span className="text-3xl">🛒</span>
        </div>
      )}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs font-medium text-gray-900 leading-tight flex-1">{product.name}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-sm" style={{ color: "#7c5cf8" }}>
              {fmtBRL(product.priceCents)}
            </p>
            {originalPrice && (
              <p className="text-[10px] text-gray-400 line-through">{fmtBRL(originalPrice)}</p>
            )}
          </div>
          {qty === 0 ? (
            <button
              onClick={onAdd}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white transition active:scale-95"
              style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
            >
              <Plus size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onDec}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center transition hover:bg-gray-50"
              >
                <Minus size={12} className="text-gray-600" />
              </button>
              <span className="w-5 text-center text-sm font-bold text-gray-900">{qty}</span>
              <button
                onClick={onInc}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white transition active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cart Sheet ─────────────────────────────────────────────────────────────────

function CartSheet({
  items, totalCents, tableId, name, phone, cpf,
  onInc, onDec, onRemove, onClose, onSuccess,
}: {
  items: CartItem[];
  totalCents: number;
  tableId: string;
  name: string;
  phone: string;
  cpf: string;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  onSuccess: (orderNum: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleOrder() {
    setLoading(true);
    setErr(null);
    try {
      const res = await CreateOrder({
        name,
        phone: phone || "00000000000",
        cep: "",
        address: "",
        items: items.map(i => ({ productId: i.product.id, qty: i.qty })),
        paymentMethodStr: "PIX",
        tableId,
        customerPhone: phone || undefined,
        customerCpf: cpf || undefined,
      } as any);
      onSuccess(res.orderNumber);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Seu pedido</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {items.map(({ product, qty }) => (
            <div key={product.id} className="flex items-center gap-3">
              {product.imageUrl && (
                <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-500">{fmtBRL(product.priceCents)} un.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => onDec(product.id)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center">
                  <Minus size={11} className="text-gray-600" />
                </button>
                <span className="w-5 text-center text-sm font-bold">{qty}</span>
                <button onClick={() => onInc(product.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                  style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}>
                  <Plus size={11} />
                </button>
                <button onClick={() => onRemove(product.id)} className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center ml-1">
                  <Trash2 size={11} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-8 pt-3 border-t border-gray-100 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-lg font-black text-gray-900">{fmtBRL(totalCents)}</span>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Pagamento na saída · Sem taxa de entrega
          </p>
          {err && <p className="text-sm text-red-500 text-center">{err}</p>}
          <button
            onClick={handleOrder}
            disabled={loading}
            className="w-full h-12 rounded-2xl font-bold text-white disabled:opacity-50 transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            {loading ? "Enviando…" : "Enviar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation ───────────────────────────────────────────────────────────────

function Confirmation({ orderNum, name, onNewOrder }: {
  orderNum: string;
  name: string;
  onNewOrder: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
      <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
      <h2 className="text-2xl font-black text-gray-900">Pedido enviado!</h2>
      <p className="text-gray-600 mt-2">
        Obrigado, <strong>{name.split(" ")[0]}</strong>! Seu pedido <strong>#{orderNum}</strong> foi recebido.
      </p>
      <p className="text-sm text-gray-500 mt-3">
        Em breve ele estará pronto. Fique à vontade!
      </p>
      <button
        onClick={onNewOrder}
        className="mt-8 h-11 px-8 rounded-2xl font-bold text-sm text-white transition hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
      >
        Fazer mais um pedido
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type Step = "name" | "register" | "catalog" | "done";

export default function MesaPage() {
  const { tableId } = useParams<{ tableId: string }>();

  const [step,  setStep]  = useState<Step>("name");
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [cpf,   setCpf]   = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [search,  setSearch]  = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [orderNum, setOrderNum] = useState("");

  const cart = useLocalCart();

  // Resolve slug da empresa a partir do tableId (endpoint público, sem auth)
  const { data: tableInfo } = useQuery({
    queryKey: ["mesa-info", tableId],
    queryFn: () => fetchTableInfo(tableId!),
    enabled: !!tableId,
    staleTime: Infinity,
  });

  const api = tableInfo ? makeCatalogApi(tableInfo.slug) : null;

  const { data: sf }               = useQuery({ queryKey: ["storefront", tableInfo?.slug], queryFn: api!.storefront,  enabled: !!api });
  const { data: categories = [] }  = useQuery<Category[]>({ queryKey: ["categories", tableInfo?.slug], queryFn: api!.categories,  enabled: !!api });
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["products", tableInfo?.slug, catSlug, search],
    queryFn: () => api!.products(catSlug || undefined, search || undefined),
    enabled: !!api,
  });

  const brand    = sf?.storeName || "Cardápio";
  const tableNum = tableInfo?.number;

  // Debounce search
  const searchRef = useRef(search);
  searchRef.current = search;

  function handleNameNext(n: string) {
    setName(n);
    setStep("register");
  }

  function handleRegister(p: string, c: string) {
    setPhone(p);
    setCpf(c);
    setStep("catalog");
  }

  function handleSkipRegister() {
    setStep("catalog");
  }

  function handleSuccess(num: string) {
    setOrderNum(num);
    setCartOpen(false);
    cart.clear();
    setStep("done");
  }

  function handleNewOrder() {
    setStep("register");
    setName(name); // keep name
  }

  if (step === "name") {
    return <StepName brand={brand} tableNum={tableNum} onNext={handleNameNext} />;
  }

  if (step === "register") {
    return <StepRegister name={name} onSkip={handleSkipRegister} onRegister={handleRegister} />;
  }

  if (step === "done") {
    return <Confirmation orderNum={orderNum} name={name} onNewOrder={handleNewOrder} />;
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-gray-100 px-3 h-9">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={13} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            <ShoppingCart size={17} />
            {cart.totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cart.totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setCatSlug("")}
              className="shrink-0 px-3 h-7 rounded-full text-xs font-semibold transition"
              style={!catSlug
                ? { backgroundColor: "#7c5cf8", color: "#fff" }
                : { backgroundColor: "#f3f4f6", color: "#6b7280" }}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setCatSlug(c.slug)}
                className="shrink-0 px-3 h-7 rounded-full text-xs font-semibold transition"
                style={catSlug === c.slug
                  ? { backgroundColor: "#7c5cf8", color: "#fff" }
                  : { backgroundColor: "#f3f4f6", color: "#6b7280" }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Banner / greeting */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
        <p className="text-sm text-gray-500">
          Olá, <strong>{name.split(" ")[0]}</strong>! Escolha o que deseja pedir 👇
        </p>
      </div>

      {/* Products */}
      <div className="max-w-2xl mx-auto px-4 pb-32">
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-square" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map(p => {
              const qty = cart.items.find(i => i.product.id === p.id)?.qty ?? 0;
              return (
                <MesaProductCard
                  key={p.id}
                  product={p}
                  qty={qty}
                  onAdd={() => cart.add(p)}
                  onInc={() => cart.inc(p.id)}
                  onDec={() => cart.dec(p.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {cart.totalItems > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-4">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 h-14 px-6 rounded-2xl text-white shadow-lg transition hover:brightness-110 active:scale-95"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            <ShoppingCart size={18} />
            <span className="font-bold text-sm">
              Ver pedido · {fmtBRL(cart.totalCents)}
            </span>
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {cart.totalItems}
            </span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && tableId && (
        <CartSheet
          items={cart.items}
          totalCents={cart.totalCents}
          tableId={tableId}
          name={name}
          phone={phone}
          cpf={cpf}
          onInc={cart.inc}
          onDec={cart.dec}
          onRemove={cart.remove}
          onClose={() => setCartOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
