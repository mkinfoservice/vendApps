import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/features/cart/cart";
import { useNavigate } from "react-router-dom";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Tag,
  Receipt,
  ArrowRight,
  Sparkles,
} from "lucide-react";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function QtyStepper({
  qty,
  onDec,
  onInc,
  onRemove,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
}) {
  const isOne = qty <= 1;

  return (
    <div className="flex items-center rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={isOne ? onRemove : onDec}
        className="h-11 w-11 grid place-items-center hover:bg-zinc-50 active:bg-zinc-100 transition"
        aria-label={isOne ? "Remover item" : "Diminuir quantidade"}
        title={isOne ? "Remover" : "Diminuir"}
      >
        {isOne ? <Trash2 className="h-4 w-4 text-zinc-700" /> : <Minus className="h-4 w-4 text-zinc-700" />}
      </button>

      <div className="h-11 w-12 grid place-items-center text-sm font-black tabular-nums text-zinc-900">
        {qty}
      </div>

      <button
        type="button"
        onClick={onInc}
        className="h-11 w-11 grid place-items-center hover:bg-zinc-50 active:bg-zinc-100 transition"
        aria-label="Aumentar quantidade"
        title="Aumentar"
      >
        <Plus className="h-4 w-4 text-zinc-700" />
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
        className="h-[85vh] rounded-t-3xl p-0 flex flex-col bg-white text-zinc-900"
      >
        {/* handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-zinc-200" />
        </div>

        {/* header */}
        <div className="px-5 pb-4 pt-3">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5" />
                </div>

                <div>
                  <SheetTitle className="text-lg font-black tracking-tight">Seu carrinho</SheetTitle>
                  <div className="mt-0.5 text-xs text-zinc-500 flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>
                      {cart.totalItems} item(ns) • {formatBRL(cart.subtotalCents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* botão limpo com outline consistente */}
              <button
                type="button"
                onClick={cart.clear}
                disabled={!hasItems}
                className="h-10 px-3 rounded-xl border border-zinc-300 text-sm font-extrabold hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                title="Limpar carrinho"
              >
                Limpar
              </button>
            </div>
          </SheetHeader>
        </div>

        <Separator />

        {/* list */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {!hasItems ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-900" />
                <div className="text-sm font-extrabold text-zinc-900">Seu carrinho está vazio</div>
              </div>
              <div className="mt-2 text-sm text-zinc-500">
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
                    className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* left */}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-zinc-900">{i.product.name}</div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <Tag className="h-3.5 w-3.5" />
                          <span>{i.product.categoryId?.name ?? ""}</span>
                        </div>

                        <div className="mt-3 flex items-baseline gap-2">
                          <div className="text-base font-black text-zinc-900">
                            {formatBRL(itemTotal)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            ({formatBRL(i.product.priceCents)} cada)
                          </div>
                        </div>
                      </div>

                      {/* right */}
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

        <Separator />

        {/* footer */}
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-zinc-500">Subtotal</div>
              <div className="text-lg font-black tabular-nums text-zinc-900">
                {formatBRL(cart.subtotalCents)}
              </div>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Entrega e descontos serão calculados no checkout.
            </div>
          </div>

          {/* CTA premium */}
          <button
            type="button"
            disabled={!hasItems}
            onClick={() => navigate("/checkout")}
            className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-black text-base flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-40 transition"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>

          <div className="text-[11px] text-zinc-500 text-center">
            Cartão: somente na entrega • PIX: validação na próxima etapa
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
