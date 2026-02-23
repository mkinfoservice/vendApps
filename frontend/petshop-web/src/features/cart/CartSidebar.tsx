import { useCart } from "@/features/cart/cart";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CartSidebar() {
  const cart = useCart();
  const navigate = useNavigate();
  const hasItems = cart.items.length > 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" style={{ color: "#7c5cf8" }} />
            <h2 className="font-black text-gray-900 text-base">Seu Carrinho</h2>
            <span className="text-sm text-gray-400">({cart.totalItems} itens)</span>
          </div>
          {hasItems && (
            <button
              type="button"
              onClick={cart.clear}
              className="text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="max-h-[420px] overflow-y-auto">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">Seu carrinho está vazio</p>
            <p className="text-xs text-gray-400 text-center px-4">
              Adicione produtos para continuar
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cart.items.map((item) => {
              const img = (item.product as any).imageUrl || "https://picsum.photos/seed/pet/200/200";
              return (
                <div key={item.product.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100">
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
                  </div>

                  {/* Controles */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        item.qty === 1
                          ? cart.remove(item.product.id)
                          : cart.dec(item.product.id)
                      }
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                      aria-label={item.qty === 1 ? "Remover" : "Diminuir"}
                    >
                      {item.qty === 1 ? (
                        <Trash2 className="w-3 h-3 text-red-400" />
                      ) : (
                        <Minus className="w-3 h-3 text-gray-600" />
                      )}
                    </button>

                    <span className="w-5 text-center text-sm font-black text-gray-900 tabular-nums select-none">
                      {item.qty}
                    </span>

                    <button
                      type="button"
                      onClick={() => cart.inc(item.product.id)}
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
                      style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
                      aria-label="Aumentar"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasItems && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-xl font-black text-gray-900 tabular-nums">
              {formatBRL(cart.subtotalCents)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/checkout")}
            className="w-full py-3.5 rounded-2xl font-black text-base text-white transition hover:brightness-110 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            Finalizar Pedido
          </button>
        </div>
      )}
    </div>
  );
}
