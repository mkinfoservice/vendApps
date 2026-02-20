import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/features/cart/cart";
import { useNavigate } from "react-router-dom";
import {
  Minus, Plus, Trash2, ShoppingBag, Tag, Receipt, ArrowRight, Sparkles,
} from "lucide-react";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function QtyStepper({
  qty, onDec, onInc, onRemove,
}: { qty: number; onDec: () => void; onInc: () => void; onRemove: () => void }) {
  const isOne = qty <= 1;
  return (
    <div
      className="flex items-center rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
    >
      <button
        type="button"
        onClick={isOne ? onRemove : onDec}
        className="h-11 w-11 grid place-items-center hover:bg-[var(--surface)] transition"
        aria-label={isOne ? "Remover item" : "Diminuir quantidade"}
      >
        {isOne
          ? <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
          : <Minus className="h-4 w-4 text-[var(--text-muted)]" />}
      </button>

      <div className="h-11 w-12 grid place-items-center text-sm font-black tabular-nums text-[var(--text)]">
        {qty}
      </div>

      <button
        type="button"
        onClick={onInc}
        className="h-11 w-11 grid place-items-center hover:bg-[var(--surface)] transition"
        aria-label="Aumentar quantidade"
      >
        <Plus className="h-4 w-4 text-[var(--text-muted)]" />
      </button>
    </div>
  );
}

export function CartSheet({ children }: { children: React.ReactNode }) {
  const cart = useCart();
  const navigate = useNavigate();
  const hasItems = cart.items.length > 0;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-3xl p-0 flex flex-col"
        style={{ backgroundColor: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
      >
        {/* handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: "var(--border)" }} />
        </div>

        {/* header */}
        <div className="px-5 pb-4 pt-3">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "#7c5cf8" }}
                >
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>

                <div>
                  <SheetTitle className="text-lg font-black tracking-tight text-[var(--text)]">
                    Seu carrinho
                  </SheetTitle>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{cart.totalItems} item(ns) • {formatBRL(cart.subtotalCents)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={cart.clear}
                disabled={!hasItems}
                className="h-10 px-3 rounded-xl border text-sm font-extrabold disabled:opacity-40 transition hover:bg-[var(--surface-2)]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Limpar
              </button>
            </div>
          </SheetHeader>
        </div>

        <Separator style={{ backgroundColor: "var(--border)" }} />

        {/* list */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {!hasItems ? (
            <div
              className="rounded-3xl border p-5"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: "#7c5cf8" }} />
                <div className="text-sm font-extrabold text-[var(--text)]">Seu carrinho está vazio</div>
              </div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">
                Adicione itens do catálogo para continuar.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.items.map((i) => {
                const itemTotal = i.product.priceCents * i.qty;
                return (
                  <div
                    key={i.product.id}
                    className="rounded-3xl border p-4"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[var(--text)]">{i.product.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <Tag className="h-3.5 w-3.5" />
                          <span>{(i.product as any).categoryId?.name ?? ""}</span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                          <div className="text-base font-black text-[var(--text)]">
                            {formatBRL(itemTotal)}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            ({formatBRL(i.product.priceCents)} cada)
                          </div>
                        </div>
                      </div>

                      <QtyStepper
                        qty={i.qty}
                        onDec={() => cart.dec(i.product.id)}
                        onInc={() => cart.inc(i.product.id)}
                        onRemove={() => cart.remove(i.product.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator style={{ backgroundColor: "var(--border)" }} />

        {/* footer */}
        <div className="px-5 py-4 space-y-3">
          <div
            className="rounded-3xl border p-4"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-[var(--text-muted)]">Subtotal</div>
              <div className="text-lg font-black tabular-nums" style={{ color: "#7c5cf8" }}>
                {formatBRL(cart.subtotalCents)}
              </div>
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Entrega e descontos serão calculados no checkout.
            </div>
          </div>

          <button
            type="button"
            disabled={!hasItems}
            onClick={() => navigate("/checkout")}
            className="w-full h-12 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 disabled:opacity-40 transition"
            style={{ backgroundColor: "#7c5cf8" }}
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>

          <div className="text-[11px] text-[var(--text-muted)] text-center">
            Cartão: somente na entrega • PIX: validação na próxima etapa
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
