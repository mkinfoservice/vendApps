type Props = {
  onCategoryClick?: (slug: string) => void;
};

export function HeroBanner({ onCategoryClick }: Props) {
  return (
    <div
      className="relative mt-4 rounded-2xl overflow-hidden min-h-[160px] sm:min-h-[200px] flex items-end"
      style={{ background: "linear-gradient(135deg, #5b3fd4 0%, #7c5cf8 50%, #9b7efa 100%)" }}
    >
      {/* Círculos decorativos */}
      <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full opacity-10 bg-white" />
      <div className="absolute top-[20px] right-[60px] w-24 h-24 rounded-full opacity-10 bg-white" />

      {/* Conteúdo */}
      <div className="relative z-10 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-end sm:justify-between w-full gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white/80 uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Super Ofertas
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            Promoções<br />Imperdíveis
          </h2>
          <p className="text-sm text-white/75 mt-1.5">
            Descontos especiais em produtos selecionados
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCategoryClick?.("")}
          className="self-start sm:self-auto shrink-0 h-10 px-6 rounded-xl bg-white text-sm font-bold transition hover:bg-white/90 active:scale-95"
          style={{ color: "#7c5cf8" }}
        >
          Ver Ofertas
        </button>
      </div>
    </div>
  );
}
