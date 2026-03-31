import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart, Plus, Minus, Trash2, Search, X,
  CheckCircle2, Star, ChevronRight,
} from "lucide-react";
import type { Category, Product, ProductAddon, ProductVariant, StoreFrontConfig } from "@/features/catalog/api";
import { CreateOrder, identifyCustomer } from "@/features/orders/api";

// ── Catalog helpers com slug explícito ────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

async function fetchTableInfo(tableId: string): Promise<{ slug: string; number: number; name: string | null; capacity: number }> {
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

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Design tokens Go Coffee ────────────────────────────────────────────────────
const GC = {
  bg:      "#FAF7F2",
  cream:   "#F5EDE0",
  brown:   "#6B4F3A",
  dark:    "#1C1209",
  caramel: "#C8953A",
};

const CAT_ICONS: [string, string][] = [
  ["bebidas geladas", "🧊"], ["bebidas quentes", "☕"], ["frappes", "🧋"],
  ["donuts", "🍩"], ["tortas", "🥧"], ["waffles doces", "🧇"],
  ["waffles salgados", "🧇"], ["salgados especiais", "⭐"], ["salgados", "🥐"],
  ["doces", "🍰"], ["go toast", "🍞"], ["sanduíches", "🥪"],
];
function catIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [k, v] of CAT_ICONS) if (lower.includes(k)) return v;
  return "🍽️";
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
  function inc(id: string) { setItems(prev => prev.map(i => i.product.id === id ? { ...i, qty: i.qty + 1 } : i)); }
  function dec(id: string) { setItems(prev => prev.map(i => i.product.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0)); }
  function remove(id: string) { setItems(prev => prev.filter(i => i.product.id !== id)); }
  function clear() { setItems([]); }
  const totalCents = items.reduce((s, i) => s + i.product.priceCents * i.qty, 0);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  return { items, add, inc, dec, remove, clear, totalCents, totalItems };
}

// ── Step 1: Entrada ────────────────────────────────────────────────────────────
function StepName({ brand, tableNum, tableName, maxGuests, initialName, initialGuests, logoUrl, tableId, onNext, onLogin }: {
  brand: string;
  tableNum?: number;
  tableName?: string | null;
  maxGuests: number;
  initialName?: string;
  initialGuests?: number;
  logoUrl?: string | null;
  tableId: string;
  onNext: (name: string, guests: number) => void;
  onLogin: (name: string, phone: string, customerId: string, pointsBalance: number) => void;
}) {
  const [tab,     setTab]     = useState<"new" | "login">("new");
  const [name,    setName]    = useState(initialName ?? "");
  const [guests,  setGuests]  = useState(Math.min(Math.max(initialGuests ?? 1, 1), Math.max(maxGuests, 1)));
  const [phone,   setPhone]   = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [found,   setFound]   = useState<{ name: string; points: number; customerId: string } | null>(null);

  async function handleLogin() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    setLoading(true); setErr(null); setFound(null);
    try {
      const res = await identifyCustomer(tableId, "lookup", digits);
      if (!res.isNew) {
        setFound({ name: res.name, points: res.pointsBalance, customerId: res.customerId });
      } else {
        setErr("Número não encontrado. Tente como novo cliente.");
      }
    } catch {
      setErr("Erro ao buscar cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function confirmLogin() {
    if (!found) return;
    onLogin(found.name, phone.replace(/\D/g, ""), found.customerId, found.points);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: GC.bg }}>
      <div className="flex flex-col items-center justify-center flex-1 px-5 py-10">
        <div className="w-full max-w-sm space-y-6">

          {/* Brand */}
          <div className="text-center space-y-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brand} className="h-16 mx-auto object-contain" />
            ) : (
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 8px 32px rgba(28,18,9,0.25)" }}>
                <span className="text-3xl font-black text-white">{brand.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black" style={{ color: GC.dark }}>{brand}</h1>
              {tableNum && (
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${GC.caramel}18`, color: GC.caramel }}>
                  Mesa {tableNum}{tableName ? ` · ${tableName}` : ""} · Auto-atendimento
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="p-1 rounded-2xl flex gap-1" style={{ background: GC.cream }}>
            {(["new", "login"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setErr(null); setFound(null); }}
                className="flex-1 h-10 rounded-xl text-sm font-bold transition-all duration-200"
                style={tab === t ? {
                  background: GC.dark, color: "#fff",
                  boxShadow: "0 2px 10px rgba(28,18,9,0.2)",
                } : { color: GC.brown }}>
                {t === "new" ? "Sou novo aqui" : "Já tenho cadastro"}
              </button>
            ))}
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl p-6 space-y-4"
            style={{ boxShadow: "0 4px 24px rgba(28,18,9,0.08)" }}>

            {tab === "new" ? (
              <>
                <div>
                  <h2 className="text-lg font-black" style={{ color: GC.dark }}>Olá! Qual é o seu nome?</h2>
                  <p className="text-sm mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>Pagamento no caixa ao finalizar a mesa.</p>
                </div>
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && name.trim()) onNext(name.trim(), guests); }}
                  placeholder="Seu nome"
                  className="w-full rounded-2xl px-4 text-base focus:outline-none focus:ring-2 transition"
                  style={{ height: 52, border: `1.5px solid rgba(107,79,58,0.15)`, color: GC.dark, ["--tw-ring-color" as string]: GC.caramel + "40" }}
                />
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: GC.brown, opacity: 0.6 }}>
                    Quantas pessoas? (max {maxGuests})
                  </label>
                  <div className="flex items-center gap-3 px-4 rounded-2xl" style={{ height: 52, border: `1.5px solid rgba(107,79,58,0.15)` }}>
                    <button onClick={() => setGuests(g => Math.max(1, g - 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition"
                      style={{ background: GC.cream, color: GC.brown }}>−</button>
                    <span className="flex-1 text-center font-black text-lg" style={{ color: GC.dark }}>{guests}</span>
                    <button onClick={() => setGuests(g => Math.min(maxGuests, g + 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition"
                      style={{ background: GC.cream, color: GC.brown }}>+</button>
                  </div>
                </div>
                <button onClick={() => name.trim() && onNext(name.trim(), guests)} disabled={!name.trim()}
                  className="w-full h-13 rounded-2xl font-bold text-white text-base disabled:opacity-40 transition active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ height: 52, background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 16px rgba(28,18,9,0.25)" }}>
                  Continuar <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-black" style={{ color: GC.dark }}>Bem-vindo de volta!</h2>
                  <p className="text-sm mt-0.5" style={{ color: GC.brown, opacity: 0.6 }}>Digite seu telefone para entrar e pontuar.</p>
                </div>

                {!found ? (
                  <>
                    <input autoFocus type="tel" value={phone} onChange={e => setPhone(maskPhone(e.target.value))}
                      onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                      placeholder="(11) 99999-9999"
                      className="w-full rounded-2xl px-4 text-base focus:outline-none focus:ring-2 transition"
                      style={{ height: 52, border: `1.5px solid rgba(107,79,58,0.15)`, color: GC.dark, ["--tw-ring-color" as string]: GC.caramel + "40" }}
                    />
                    {err && <p className="text-sm text-red-500 font-medium">{err}</p>}
                    <button onClick={handleLogin} disabled={phone.replace(/\D/g, "").length < 10 || loading}
                      className="w-full h-13 rounded-2xl font-bold text-white text-base disabled:opacity-40 transition active:scale-[0.98]"
                      style={{ height: 52, background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 4px 16px rgba(28,18,9,0.25)" }}>
                      {loading ? "Buscando…" : "Entrar"}
                    </button>
                    <button onClick={() => { setTab("new"); setErr(null); }}
                      className="w-full text-sm font-medium text-center transition"
                      style={{ color: GC.brown, opacity: 0.6 }}>
                      Primeiro acesso? Cadastre-se →
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl px-5 py-4 text-center"
                      style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
                      <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Olá,</p>
                      <p className="text-white text-2xl font-black mt-0.5">{found.name.split(" ")[0]}</p>
                      {found.points > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                          style={{ background: `${GC.caramel}30` }}>
                          <Star className="w-3 h-3 fill-current" style={{ color: GC.caramel }} />
                          <span className="text-xs font-bold" style={{ color: GC.caramel }}>{found.points} pontos</span>
                        </div>
                      )}
                    </div>
                    <button onClick={confirmLogin}
                      className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98]"
                      style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)`, boxShadow: `0 4px 16px ${GC.caramel}44` }}>
                      Entrar no cardápio
                    </button>
                    <button onClick={() => setFound(null)}
                      className="w-full text-sm font-medium text-center"
                      style={{ color: GC.brown, opacity: 0.5 }}>
                      Não sou eu
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Fidelidade ─────────────────────────────────────────────────────────
function StepRegister({ name, tableId, primaryColor, onSkip, onRegister }: {
  name: string; tableId: string; primaryColor?: string;
  onSkip: () => void;
  onRegister: (phone: string, cpf: string, customerId: string, pointsBalance: number, isNew: boolean) => void;
}) {
  const [phone,   setPhone]   = useState("");
  const [cpf,     setCpf]     = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const color = primaryColor || "#7c5cf8";

  async function handleRegister() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    setLoading(true); setErr(null);
    try {
      const res = await identifyCustomer(tableId, name, digits, cpf.replace(/\D/g, "") || undefined);
      onRegister(digits, cpf.replace(/\D/g, ""), res.customerId, res.pointsBalance, res.isNew);
    } catch {
      setErr("Não foi possível identificar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8" style={{ backgroundColor: "#fafafa" }}>
      <div className="w-full max-w-sm space-y-4">

        {/* Loyalty pitch */}
        <div className="rounded-3xl overflow-hidden shadow-sm"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
          <div className="px-6 py-6 text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <Star className="w-5 h-5 fill-white text-white" />
              </div>
              <div>
                <p className="font-bold text-base">Programa de Fidelidade</p>
                <p className="text-xs text-white/70">Acumule pontos e ganhe descontos</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs flex-shrink-0">✦</span>
                A cada compra você ganha pontos automáticos
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs flex-shrink-0">✦</span>
                Troque por descontos nas próximas visitas
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs flex-shrink-0">✦</span>
                Promoções exclusivas para membros
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <p className="font-bold text-gray-900 text-base">
              Quer participar, {name.split(" ")[0]}?
            </p>
            <p className="text-sm text-gray-400 mt-0.5">Cadastro rápido, só o telefone</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telefone *</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 transition"
                style={{ ["--tw-ring-color" as string]: color + "40" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                CPF <span className="font-normal text-gray-300">· opcional</span>
              </label>
              <input
                type="text"
                value={cpf}
                onChange={e => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 transition"
                style={{ ["--tw-ring-color" as string]: color + "40" }}
              />
            </div>
          </div>

          {err && <p className="text-sm text-red-500 text-center font-medium">{err}</p>}

          <button
            onClick={handleRegister}
            disabled={phone.replace(/\D/g, "").length < 10 || loading}
            className="w-full h-12 rounded-2xl font-bold text-sm text-white disabled:opacity-40 transition active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            {loading ? "Identificando…" : "Cadastrar e ganhar pontos"}
          </button>

          <button
            onClick={onSkip}
            disabled={loading}
            className="w-full text-sm text-gray-400 hover:text-gray-700 transition py-1 font-medium disabled:opacity-40"
          >
            Agora não, só quero pedir →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Detail Sheet ───────────────────────────────────────────────────────
function ProductDetailSheet({ product, primaryColor, onClose, onAddToCart }: {
  product: Product; primaryColor?: string;
  onClose: () => void;
  onAddToCart: (product: Product, variant: ProductVariant | null, addons: ProductAddon[], qty: number) => void;
}) {
  const color = primaryColor || GC.caramel;
  const hasVariants = product.variants.length > 0;
  const hasAddons   = product.addons.length > 0;

  // Group variants by key
  const variantGroups = product.variants.reduce<Record<string, ProductVariant[]>>((acc, v) => {
    (acc[v.variantKey] ??= []).push(v);
    return acc;
  }, {});

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants ? product.variants[0] : null
  );
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);

  function toggleAddon(id: string) {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const activeAddons = product.addons.filter(a => selectedAddons.has(a.id));
  const basePrice    = selectedVariant?.priceCents ?? product.priceCents;
  const addonsTotal  = activeAddons.reduce((s, a) => s + a.priceCents, 0);
  const total        = (basePrice + addonsTotal) * qty;

  function handleAdd() {
    onAddToCart(product, selectedVariant, activeAddons, qty);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: GC.bg, boxShadow: "0 24px 80px rgba(28,18,9,0.35)" }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(107,79,58,0.2)" }} />
        </div>

        {/* Image */}
        {product.imageUrl && (
          <div className="relative w-full shrink-0" style={{ height: 200 }}>
            <img src={product.imageUrl} alt={product.name}
              className="w-full h-full object-cover" />
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(250,247,242,1) 0%, transparent 60%)" }} />
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-2">

          {/* Title + description */}
          <div className="pt-3 pb-4 border-b" style={{ borderColor: "rgba(107,79,58,0.1)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {product.isBestSeller && (
                  <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-1.5"
                    style={{ background: `linear-gradient(135deg, ${GC.caramel}, #A87830)`, color: "#fff" }}>
                    ★ Favorito
                  </span>
                )}
                <h2 className="text-xl font-black leading-tight" style={{ color: GC.dark }}>{product.name}</h2>
                {product.description && (
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: GC.brown, opacity: 0.8 }}>
                    {product.description}
                  </p>
                )}
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: GC.cream }}>
                <X size={14} style={{ color: GC.brown }} />
              </button>
            </div>
            <p className="text-2xl font-black mt-3" style={{ color }}>
              {fmtBRL(basePrice)}
              {addonsTotal > 0 && (
                <span className="text-sm font-medium ml-1.5" style={{ color: GC.brown, opacity: 0.6 }}>
                  + {fmtBRL(addonsTotal)} extras
                </span>
              )}
            </p>
          </div>

          {/* Variants */}
          {Object.entries(variantGroups).map(([key, variants]) => (
            <div key={key} className="py-4 border-b" style={{ borderColor: "rgba(107,79,58,0.1)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-3"
                style={{ color: GC.brown, opacity: 0.5 }}>{key}</p>
              <div className="flex flex-wrap gap-2">
                {variants.map(v => {
                  const active = selectedVariant?.id === v.id;
                  return (
                    <button key={v.id} onClick={() => setSelectedVariant(v)}
                      className="px-4 py-2 rounded-2xl text-sm font-bold transition-all duration-150"
                      style={active ? {
                        background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`,
                        color: "#fff",
                        boxShadow: "0 4px 14px rgba(28,18,9,0.25)",
                      } : {
                        background: GC.cream,
                        color: GC.brown,
                        border: `1.5px solid rgba(200,149,58,0.2)`,
                      }}>
                      {v.variantValue}
                      {v.priceCents != null && v.priceCents !== product.priceCents && (
                        <span className="ml-1.5 text-[11px] opacity-70">{fmtBRL(v.priceCents)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Addons */}
          {hasAddons && (
            <div className="py-4">
              <p className="text-xs font-black uppercase tracking-widest mb-3"
                style={{ color: GC.brown, opacity: 0.5 }}>Adicionais</p>
              <div className="space-y-2">
                {product.addons.map(a => {
                  const checked = selectedAddons.has(a.id);
                  return (
                    <button key={a.id} onClick={() => toggleAddon(a.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 text-left"
                      style={checked ? {
                        background: `linear-gradient(135deg, ${GC.dark}08, ${GC.dark}12)`,
                        border: `1.5px solid ${GC.dark}22`,
                      } : {
                        background: GC.cream,
                        border: `1.5px solid transparent`,
                      }}>
                      <div className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-all"
                        style={checked ? {
                          background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`,
                        } : {
                          border: `2px solid rgba(107,79,58,0.25)`,
                          background: "transparent",
                        }}>
                        {checked && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                      <span className="flex-1 text-sm font-semibold" style={{ color: GC.dark }}>{a.name}</span>
                      <span className="text-sm font-bold shrink-0"
                        style={{ color: a.priceCents === 0 ? GC.brown : color, opacity: a.priceCents === 0 ? 0.5 : 1 }}>
                        {a.priceCents === 0 ? "Grátis" : `+${fmtBRL(a.priceCents)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer: qty + add */}
        <div className="px-5 pt-4 pb-8 shrink-0"
          style={{ borderTop: "1px solid rgba(107,79,58,0.08)", background: GC.bg }}>
          <div className="flex items-center gap-3">
            {/* Qty */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-2xl"
              style={{ background: GC.cream }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
                style={{ background: qty <= 1 ? "rgba(107,79,58,0.1)" : GC.dark, color: qty <= 1 ? GC.brown : "#fff" }}>
                <Minus size={13} />
              </button>
              <span className="w-6 text-center font-black text-base" style={{ color: GC.dark }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white transition active:scale-90"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
                <Plus size={13} />
              </button>
            </div>

            {/* Add button */}
            <button onClick={handleAdd}
              className="flex-1 h-12 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`,
                boxShadow: "0 4px 16px rgba(28,18,9,0.30)",
              }}>
              <ShoppingCart size={16} />
              Adicionar · {fmtBRL(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product Card (horizontal) ──────────────────────────────────────────────────
function MesaProductCard({ product, qty, primaryColor, onOpen, onInc, onDec }: {
  product: Product; qty: number; primaryColor?: string;
  onOpen: () => void; onInc: () => void; onDec: () => void;
}) {
  const color = primaryColor || GC.caramel;
  const discount = product.discountPercent;
  const original = discount ? Math.round(product.priceCents / (1 - discount / 100)) : null;
  const hasOptions = product.variants.length > 0 || product.addons.length > 0;

  return (
    <button onClick={onOpen} className="w-full text-left"
      style={{ WebkitTapHighlightColor: "transparent" }}>
      <div className="bg-white rounded-2xl overflow-hidden flex gap-0 transition-all duration-200 active:scale-[0.98]"
        style={{ boxShadow: "0 2px 12px rgba(28,18,9,0.07), 0 1px 3px rgba(28,18,9,0.04)" }}>

        {/* Text side */}
        <div className="flex-1 p-3.5 flex flex-col gap-1 min-w-0">
          {product.isBestSeller && (
            <span className="text-[9px] font-black uppercase tracking-wider w-fit px-1.5 py-0.5 rounded-full"
              style={{ background: `${GC.caramel}20`, color: GC.caramel }}>★ Top</span>
          )}
          <p className="text-[13px] font-bold leading-snug line-clamp-2" style={{ color: GC.dark }}>
            {product.name}
          </p>
          {product.description && (
            <p className="text-[11px] leading-snug line-clamp-2 mt-0.5" style={{ color: GC.brown, opacity: 0.65 }}>
              {product.description}
            </p>
          )}
          <div className="flex items-center justify-between mt-auto pt-2">
            <div>
              <p className="text-[14px] font-black" style={{ color }}>{fmtBRL(product.priceCents)}</p>
              {original && (
                <p className="text-[10px] line-through" style={{ color: GC.brown, opacity: 0.35 }}>{fmtBRL(original)}</p>
              )}
            </div>
            {qty === 0 ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white transition"
                style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`, boxShadow: "0 3px 10px rgba(28,18,9,0.25)" }}>
                <Plus size={15} />
              </div>
            ) : (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={onDec}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90"
                  style={{ background: GC.cream, color: GC.brown }}>
                  <Minus size={11} />
                </button>
                <span className="w-5 text-center text-sm font-black" style={{ color: GC.dark }}>{qty}</span>
                <button onClick={e => { e.stopPropagation(); onInc(); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white transition active:scale-90"
                  style={{ background: `linear-gradient(135deg, ${GC.dark}, #3D2314)` }}>
                  <Plus size={11} />
                </button>
              </div>
            )}
          </div>
          {hasOptions && qty === 0 && (
            <p className="text-[10px] font-medium mt-0.5" style={{ color: GC.caramel, opacity: 0.8 }}>
              Toque para personalizar →
            </p>
          )}
        </div>

        {/* Image side */}
        <div className="w-28 shrink-0 relative self-stretch" style={{ backgroundColor: GC.cream }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name}
              className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${GC.cream}, #EDE0CE)` }}>
              <span style={{ fontSize: 28, opacity: 0.3 }}>☕</span>
            </div>
          )}
          {discount ? (
            <div className="absolute top-2 right-2 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "#E05252" }}>-{discount}%</div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ── Cart Sheet ─────────────────────────────────────────────────────────────────
function CartSheet({ items, totalCents, tableId, tableLabel, guests, name, phone, cpf, customerId, primaryColor,
  onInc, onDec, onRemove, onClose, onSuccess }: {
  items: CartItem[]; totalCents: number; tableId: string;
  tableLabel?: string;
  guests: number;
  name: string; phone: string; cpf: string; customerId: string | null; primaryColor?: string;
  onInc: (id: string) => void; onDec: (id: string) => void;
  onRemove: (id: string) => void; onClose: () => void;
  onSuccess: (orderNum: string, davCode?: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const color = primaryColor || "#7c5cf8";

  async function handleOrder() {
    setLoading(true); setErr(null);
    try {
      const res = await CreateOrder({
        name, phone: phone || "00000000000", cep: "", address: "",
        items: items.map(i => ({ productId: i.product.id, qty: i.qty })),
        paymentMethodStr: "PAY_AT_COUNTER", tableId,
        complement: `Mesa com ${guests} pessoa(s)`,
        customerCpf: cpf || undefined,
        ...(customerId ? { customerId } : {}),
      } as any);
      onSuccess(res.orderNumber, res.davPublicId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar pedido.");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900 text-lg">Seu pedido</h2>
            <p className="text-xs text-gray-400">
              {tableLabel ? `${tableLabel} · ` : ""}{items.length} iten{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center transition hover:bg-gray-200">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.map(({ product, qty }) => (
            <div key={product.id} className="flex items-center gap-3">
              {product.imageUrl && (
                <img src={product.imageUrl} alt={product.name}
                  className="w-14 h-14 rounded-2xl object-cover bg-gray-50 shrink-0 shadow-sm" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtBRL(product.priceCents)} · un.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => onDec(product.id)}
                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center transition hover:bg-gray-50 active:scale-90">
                  <Minus size={11} className="text-gray-600" />
                </button>
                <span className="w-6 text-center text-sm font-black text-gray-900">{qty}</span>
                <button onClick={() => onInc(product.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white transition active:scale-90"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
                  <Plus size={11} />
                </button>
                <button onClick={() => onRemove(product.id)}
                  className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center ml-1 transition hover:bg-red-100 active:scale-90">
                  <Trash2 size={11} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-10 pt-4 border-t border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500">Total</span>
            <span className="text-2xl font-black text-gray-900">{fmtBRL(totalCents)}</span>
          </div>
          <p className="text-xs text-gray-400 text-center -mt-2">
            Pagamento no caixa ao finalizar a mesa · Sem taxa de entrega
          </p>
          {err && <p className="text-sm text-red-500 text-center font-medium">{err}</p>}
          <button
            onClick={handleOrder}
            disabled={loading}
            className="w-full h-14 rounded-2xl font-black text-base text-white disabled:opacity-50 transition active:scale-[0.98] shadow-lg"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              boxShadow: `0 8px 24px ${color}40` }}
          >
            {loading ? "Enviando…" : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation ───────────────────────────────────────────────────────────────
function Confirmation({ orderNum, davCode, name, primaryColor, onNewOrder }: {
  orderNum: string; davCode?: string | null; name: string; primaryColor?: string; onNewOrder: () => void;
}) {
  const color = primaryColor || "#7c5cf8";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: "#fafafa" }}>
      <div className="w-full max-w-xs space-y-6">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-black text-gray-900">Pedido enviado!</h2>
          <p className="text-gray-500">
            Obrigado, <strong className="text-gray-800">{name.split(" ")[0]}</strong>!
          </p>
          <div className="inline-block px-4 py-2 rounded-2xl mt-2"
            style={{ backgroundColor: `${color}10`, color }}>
            <span className="text-xs font-semibold">Pedido</span>
            <span className="text-lg font-black ml-2">#{orderNum}</span>
          </div>
          {davCode && (
            <div className="inline-block px-4 py-2 rounded-2xl mt-2"
              style={{ backgroundColor: "#ecfdf3", color: "#047857" }}>
              <span className="text-xs font-semibold">Codigo para pagamento no caixa</span>
              <span className="text-lg font-black ml-2">{davCode}</span>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">
          Seu pedido foi recebido e está sendo preparado. {davCode ? "Mostre o codigo DAV no caixa para importar e pagar." : "O pagamento sera no caixa quando finalizar a mesa."}
        </p>

        <button
          onClick={onNewOrder}
          className="w-full h-12 rounded-2xl font-bold text-sm text-white transition active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          Fazer mais um pedido
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
type Step = "name" | "register" | "catalog" | "done";

export default function MesaPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const initialHost = useMemo(() => searchParams.get("host")?.trim() ?? "", [searchParams]);
  const initialGuests = useMemo(() => {
    const raw = parseInt(searchParams.get("guests") ?? "1");
    return Number.isFinite(raw) ? Math.max(raw, 1) : 1;
  }, [searchParams]);

  const [step,     setStep]     = useState<Step>("name");
  const [name,     setName]     = useState(initialHost);
  const [guests,   setGuests]   = useState(initialGuests);
  const [phone,        setPhone]        = useState("");
  const [cpf,          setCpf]          = useState("");
  const [customerId,   setCustomerId]   = useState<string | null>(null);
  const [_customerPoints, setCustomerPoints] = useState(0);
  const [_customerIsNew,  setCustomerIsNew]  = useState(false);
  const [catSlug,      setCatSlug]      = useState("");
  const [search,       setSearch]       = useState("");
  const [cartOpen,     setCartOpen]     = useState(false);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [orderNum, setOrderNum] = useState("");
  const [davCode, setDavCode] = useState<string>("");

  const cart = useLocalCart();

  // 1. Resolve slug pelo tableId (público, sem auth)
  const { data: tableInfo } = useQuery({
    queryKey: ["mesa-info", tableId],
    queryFn: () => fetchTableInfo(tableId!),
    enabled: !!tableId,
    staleTime: Infinity,
  });

  const slug = tableInfo?.slug;

  // 2. Catalog queries — só rodam quando slug está disponível
  const { data: sf } = useQuery({
    queryKey: ["mesa-storefront", slug],
    queryFn: () => makeCatalogApi(slug!).storefront(),
    enabled: !!slug,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["mesa-categories", slug],
    queryFn: () => makeCatalogApi(slug!).categories(),
    enabled: !!slug,
  });
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["mesa-products", slug, catSlug, search],
    queryFn: () => makeCatalogApi(slug!).products(catSlug || undefined, search || undefined),
    enabled: !!slug,
  });

  const primaryColor = sf?.primaryColor || "#7c5cf8";
  const brand        = sf?.storeName || "Cardápio";
  const logoUrl      = sf?.logoUrl;
  const tableNum     = tableInfo?.number;
  const tableName    = tableInfo?.name;
  const tableCapacity = tableInfo?.capacity ?? 4;
  const safeGuests = Math.min(Math.max(guests, 1), Math.max(tableCapacity, 1));

  function handleNameNext(n: string, g: number) { setName(n); setGuests(g); setStep("register"); }
  function handleRegister(p: string, c: string, cid: string, pts: number, isNew: boolean) {
    setPhone(p); setCpf(c); setCustomerId(cid); setCustomerPoints(pts); setCustomerIsNew(isNew);
    setStep("catalog");
  }
  function handleSkipRegister() { setCustomerId(null); setStep("catalog"); }
  function handleSuccess(num: string, code?: string | null) {
    setOrderNum(num);
    setDavCode(code ?? "");
    setCartOpen(false);
    cart.clear();
    setStep("done");
  }
  function handleNewOrder() {
    setDavCode("");
    // Se o usuário já está identificado (tem nome), volta direto ao catálogo
    if (name.trim()) {
      setStep("catalog");
    } else {
      setCustomerId(null); setCustomerPoints(0); setCustomerIsNew(false);
      setStep("name");
    }
  }

  if (step === "name") {
    return (
      <StepName
        brand={brand}
        tableNum={tableNum}
        tableName={tableName}
        maxGuests={Math.max(tableCapacity, 1)}
        initialName={name}
        initialGuests={safeGuests}
        logoUrl={logoUrl}
        tableId={tableId ?? ""}
        onNext={handleNameNext}
        onLogin={(n, p, cid, pts) => {
          setName(n); setPhone(p); setCustomerId(cid);
          setCustomerPoints(pts); setCustomerIsNew(false);
          setStep("catalog");
        }}
      />
    );
  }
  if (step === "register") {
    return (
      <StepRegister
        name={name}
        tableId={tableId ?? ""}
        primaryColor={primaryColor}
        onSkip={handleSkipRegister}
        onRegister={handleRegister}
      />
    );
  }
  if (step === "done") {
    return <Confirmation orderNum={orderNum} davCode={davCode} name={name} primaryColor={primaryColor} onNewOrder={handleNewOrder} />;
  }

  // ── Catalog ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{
      backgroundColor: GC.bg,
      backgroundImage: `radial-gradient(ellipse 700px 400px at 100% -80px, rgba(200,149,58,0.07), transparent),
                        radial-gradient(ellipse 500px 300px at 0% 100%, rgba(61,35,20,0.05), transparent)`,
    }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md"
        style={{ boxShadow: "0 1px 0 rgba(28,18,9,0.06), 0 4px 20px rgba(28,18,9,0.04)" }}>

        {/* Brand + cart */}
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium" style={{ color: GC.brown }}>
              {tableNum ? `Mesa ${tableNum}` : "Auto-atendimento"} · {safeGuests} pessoa{safeGuests > 1 ? "s" : ""}
              {name ? <> · Olá, <span className="font-bold" style={{ color: GC.dark }}>{name.split(" ")[0]}</span></> : null}
            </p>
            <p className="text-[15px] font-black truncate" style={{ color: GC.dark }}>{brand}</p>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative h-10 rounded-2xl flex items-center gap-2 px-4 text-white text-sm font-bold shrink-0 transition active:scale-95"
            style={{
              background: cart.totalItems > 0
                ? `linear-gradient(135deg, ${GC.dark}, #3D2314)`
                : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)`,
              boxShadow: cart.totalItems > 0
                ? "0 4px 16px rgba(28,18,9,0.35)"
                : `0 4px 16px ${primaryColor}44`,
            }}
          >
            <ShoppingCart size={15} />
            {cart.totalItems > 0 ? (
              <>
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-black">{cart.totalItems}</span>
                <span className="font-black">{fmtBRL(cart.totalCents)}</span>
              </>
            ) : (
              <span>Carrinho</span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto px-4 pb-2.5">
          <div className="flex items-center gap-2 rounded-2xl px-3 h-10"
            style={{ background: GC.cream, border: `1.5px solid rgba(107,79,58,0.12)` }}>
            <Search size={14} style={{ color: GC.brown, opacity: 0.5 }} className="shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: GC.dark }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="transition hover:opacity-70">
                <X size={13} style={{ color: GC.brown }} />
              </button>
            )}
          </div>
        </div>

        {/* Categories — redesigned */}
        {categories.length > 0 && (
          <div className="overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
            <div className="flex gap-2 px-4" style={{ width: "max-content" }}>
              <button
                onClick={() => setCatSlug("")}
                className="shrink-0 flex items-center gap-1.5 px-4 h-11 rounded-2xl text-[12px] font-bold transition-all duration-200"
                style={!catSlug ? {
                  background: `linear-gradient(135deg, ${GC.dark} 0%, #3D2314 100%)`,
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(28,18,9,0.28)",
                  transform: "scale(1.02)",
                } : {
                  background: GC.cream,
                  color: GC.brown,
                  border: `1.5px solid rgba(200,149,58,0.18)`,
                }}
              >
                <span style={{ fontSize: 16 }}>🍽️</span>
                Todos
              </button>
              {(categories as Category[]).map(c => {
                const active = catSlug === c.slug;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCatSlug(c.slug)}
                    className="shrink-0 flex items-center gap-1.5 px-4 h-11 rounded-2xl text-[12px] font-bold transition-all duration-200"
                    style={active ? {
                      background: `linear-gradient(135deg, ${GC.dark} 0%, #3D2314 100%)`,
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(28,18,9,0.28)",
                      transform: "scale(1.02)",
                    } : {
                      background: GC.cream,
                      color: GC.brown,
                      border: `1.5px solid rgba(200,149,58,0.18)`,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{catIcon(c.name)}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="max-w-2xl mx-auto px-4 py-5 pb-36">
        {productsLoading || !slug ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl animate-pulse" style={{ aspectRatio: "4/3", background: GC.cream }} />
            ))}
          </div>
        ) : (products as Product[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: GC.cream }}>🔍</div>
            <p className="text-sm font-medium" style={{ color: GC.brown }}>Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(products as Product[]).map(p => {
              const qty = cart.items.find(i => i.product.id === p.id)?.qty ?? 0;
              return (
                <MesaProductCard
                  key={p.id}
                  product={p}
                  qty={qty}
                  primaryColor={primaryColor}
                  onOpen={() => setSheetProduct(p)}
                  onInc={() => cart.inc(p.id)}
                  onDec={() => cart.dec(p.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating cart */}
      {cart.totalItems > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-6">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 h-14 px-6 rounded-2xl text-white font-bold text-sm transition active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${GC.dark}, #3D2314)`,
              boxShadow: "0 8px 32px rgba(28,18,9,0.40), 0 2px 8px rgba(28,18,9,0.20)",
            }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
              style={{ background: GC.caramel }}>
              {cart.totalItems}
            </div>
            Ver pedido
            <span style={{ color: "rgba(255,255,255,0.5)" }}>·</span>
            <span className="font-black">{fmtBRL(cart.totalCents)}</span>
          </button>
        </div>
      )}

      {/* Product detail sheet */}
      {sheetProduct && (
        <ProductDetailSheet
          product={sheetProduct}
          primaryColor={primaryColor}
          onClose={() => setSheetProduct(null)}
          onAddToCart={(product, variant, addons, qty) => {
            const extraCents = addons.reduce((s, a) => s + a.priceCents, 0);
            const baseCents  = variant?.priceCents ?? product.priceCents;
            const synthetic: Product = {
              ...product,
              id: variant ? `${product.id}__${variant.id}` : product.id,
              name: [
                product.name,
                variant ? variant.variantValue : null,
                addons.length ? addons.map(a => a.name).join(", ") : null,
              ].filter(Boolean).join(" · "),
              priceCents: baseCents + extraCents,
            };
            for (let i = 0; i < qty; i++) cart.add(synthetic);
          }}
        />
      )}

      {/* Cart sheet */}
      {cartOpen && tableId && (
        <CartSheet
          items={cart.items}
          totalCents={cart.totalCents}
          tableId={tableId}
          tableLabel={tableNum ? `Mesa ${tableNum}` : undefined}
          guests={safeGuests}
          name={name}
          phone={phone}
          cpf={cpf}
          customerId={customerId}
          primaryColor={primaryColor}
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
