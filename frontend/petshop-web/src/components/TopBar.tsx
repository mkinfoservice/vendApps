import { ShoppingBag } from "lucide-react";

type Props = {
  activeCategoryName: string;
  subtotalLabel: string;
  totalItems: number;
  onOpenCart: () => void;
};

export function TopBar({ activeCategoryName, subtotalLabel, totalItems, onOpenCart }: Props) {
  return (
    <div
      className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 backdrop-blur-xl border-b"
      style={{
        backgroundColor: "rgba(13,17,28,0.85)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div className="min-w-0 flex-1">
          <div className="text-base font-black leading-tight text-[var(--text)]">MEGA PET FAIM</div>
          <div className="text-xs text-[var(--text-muted)] truncate">
            Categoria: <b className="text-[var(--text)]">{activeCategoryName}</b>
          </div>
        </div>

        {/* Subtotal */}
        <div className="text-right">
          <div className="text-sm font-black tabular-nums text-[var(--text)]">{subtotalLabel}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{totalItems} item(ns)</div>
        </div>

        {/* Carrinho */}
        <button
          type="button"
          onClick={onOpenCart}
          className="h-10 w-10 rounded-2xl border grid place-items-center relative transition hover:border-[#7c5cf8]"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          title="Carrinho"
        >
          <ShoppingBag className="h-5 w-5 text-[var(--text)]" />
          {totalItems > 0 ? (
            <span
              className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full text-white text-[11px] font-black grid place-items-center"
              style={{ backgroundColor: "#7c5cf8" }}
            >
              {totalItems}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
