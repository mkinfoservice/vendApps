import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/features/cart/cart";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
        className="h-[92vh] rounded-t-3xl p-0 flex flex-col bg-white border-0"
      >
        {/* Handle */}
        <div className="flex justify-center pt-4 shrink-0">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-4 shrink-0">
          <SheetHeader>
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-black text-gray-900 leading-tight">
                  Seu Carrinho
                </SheetTitle>
                <p className="text-xs text-gray-400">{cart.totalItems} itens</p>
              </div>
              {hasItems && (
                <button
                  type="button"
                  onClick={cart.clear}
                  className="text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  Limpar tudo
                </button>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="h-px bg-gray-100 shrink-0" />

        {/* Itens */}
        <div className="flex-1 overflow-y-auto">
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                <ShoppingBag className="w-9 h-9 text-gray-300" />
              </div>
              <p className="text-base font-semibold text-gray-500">Seu carrinho está vazio</p>
              <p className="text-sm text-gray-400">Adicione produtos para continuar</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cart.items.map((item) => {
                const itemTotal = item.product.priceCents * item.qty;
                const img = (item.product as any).imageUrl || "https://picsum.photos/seed/pet/200/200";

                return (
                  <div key={item.product.id} className="px-5 py-4 flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                      <img
                        src={img}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1 leading-tight">
                        {item.product.name}
                      </p>
                      <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: "#7c5cf8" }}>
                        {formatBRL(item.product.priceCents)}
                      </p>
                      {item.qty > 1 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Total: {formatBRL(itemTotal)}
                        </p>
                      )}
                    </div>

                    {/* Controles */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          item.qty === 1
                            ? cart.remove(item.product.id)
                            : cart.dec(item.product.id)
                        }
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                        aria-label={item.qty === 1 ? "Remover item" : "Diminuir quantidade"}
                      >
                        {item.qty === 1 ? (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-600" />
                        )}
                      </button>

                      <span className="w-6 text-center text-sm font-black text-gray-900 tabular-nums select-none">
                        {item.qty}
                      </span>

                      <button
                        type="button"
                        onClick={() => cart.inc(item.product.id)}
                        className="w-9 h-9 rounded-full text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
                        style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4 bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-2xl font-black text-gray-900 tabular-nums">
              {formatBRL(cart.subtotalCents)}
            </span>
          </div>

          <button
            type="button"
            disabled={!hasItems}
            onClick={() => navigate("/checkout")}
            className="w-full h-13 py-3.5 rounded-2xl font-black text-base text-white disabled:opacity-40 transition hover:brightness-110 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            Finalizar Pedido
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Cartão: somente na entrega • PIX: na próxima etapa
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
