import { ShoppingBag } from "lucide-react";

type Props = {
  activeCategoryName: string;
  subtotalLabel: string;
  totalItems: number;
  onOpenCart: () => void;
};

export function TopBar({ activeCategoryName, subtotalLabel, totalItems, onOpenCart }: Props) {
  return (
    <>
      {/* [TopBar] Header fixo com blur (padrão app) */}
      <div className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 bg-zinc-950/75 backdrop-blur-xl border-b border-white/10">
        {/* [TopBar.Row] Linha principal: título + resumo + ícones */}
        <div className="flex items-center gap-3">
          {/* [TopBar.Brand] Marca */}
          <div className="min-w-0 flex-1">
            <div className="text-base font-black leading-tight">MEGA PET FAIM</div>
            <div className="text-xs text-white/60 truncate">
              Categoria: <b className="text-white">{activeCategoryName}</b>
            </div>
          </div>

          {/* [TopBar.Summary] Subtotal */}
          <div className="text-right">
            <div className="text-sm font-black tabular-nums">{subtotalLabel}</div>
            <div className="text-[11px] text-white/60">{totalItems} item(ns)</div>
          </div>

          {/* [TopBar.Actions] Ícones */}
          

          

          <button
            type="button"
            onClick={onOpenCart}
            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center relative"
            title="Carrinho"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-emerald-400 text-black text-[11px] font-black grid place-items-center">
                {totalItems}
              </span>
            ) : null}
          </button>
        </div>

        
      </div>
    </>
  );
}
