type Props = {
  cartSlot: React.ReactNode;
  logoUrl?: string | null;
  storeName?: string | null;
  storeSlogan?: string | null;
  brandColor?: string;
};

export function TopBar({ cartSlot, logoUrl, storeName, storeSlogan }: Props) {
  return (
    <div className="bg-[var(--surface)] shadow-sm border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-3">
        {/* Logo / Branding */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={logoUrl ? undefined : { background: `linear-gradient(135deg, #1C1209, #3D2314)` }}
          >
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              : <span className="text-xl">☕</span>
            }
          </div>
          <div className="min-w-0">
            <div className="font-black text-[var(--text)] text-[15px] leading-tight truncate">
              {storeName || "Loja"}
            </div>
            <div className="text-xs text-[var(--text-muted)] opacity-70 leading-tight">
              {storeSlogan || "Peça pelo app"}
            </div>
          </div>
        </div>

        {/* Cart slot */}
        <div className="shrink-0">{cartSlot}</div>
      </div>
    </div>
  );
}
