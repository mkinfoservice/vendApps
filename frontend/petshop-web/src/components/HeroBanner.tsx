import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStoreFront } from "@/features/catalog/queries";
import type { BannerSlide } from "@/features/catalog/api";

type Props = {
  onCategoryClick?: (slug: string) => void;
  onProductClick?: (id: string) => void;
};

// ── Slide estático (fallback quando não há slides configurados) ────────────────

function DefaultSlide({ onCategoryClick }: { onCategoryClick?: (slug: string) => void }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden min-h-[160px] sm:min-h-[200px] flex items-end"
      style={{ background: "linear-gradient(135deg, #5b3fd4 0%, #7c5cf8 50%, #9b7efa 100%)" }}
    >
      <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full opacity-10 bg-white" />
      <div className="absolute top-[20px] right-[60px] w-24 h-24 rounded-full opacity-10 bg-white" />
      <div className="relative z-10 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white/80 uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Super Ofertas
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            Promoções<br />Imperdíveis
          </h2>
          <p className="text-sm text-white/75 mt-1.5">Descontos especiais em produtos selecionados</p>
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

// ── Slide configurado ─────────────────────────────────────────────────────────

function SlideContent({
  slide,
  primaryColor,
  onCategoryClick,
  onProductClick,
}: {
  slide: BannerSlide;
  primaryColor: string;
  onCategoryClick?: (slug: string) => void;
  onProductClick?: (id: string) => void;
}) {
  const handleCta = () => {
    if (slide.ctaType === "category" && slide.ctaTarget) {
      onCategoryClick?.(slide.ctaTarget);
    } else if (slide.ctaType === "product" && slide.ctaTarget) {
      onProductClick?.(slide.ctaTarget);
    } else if (slide.ctaType === "external" && slide.ctaTarget) {
      window.open(slide.ctaTarget, slide.ctaNewTab ? "_blank" : "_self", "noopener,noreferrer");
    }
  };

  const hasCta = slide.ctaType !== "none" && !!slide.ctaTarget && !!slide.ctaText;

  return (
    <div
      className="relative rounded-2xl overflow-hidden min-h-[160px] sm:min-h-[200px] flex items-center w-full"
      style={
        slide.imageUrl
          ? {
              backgroundImage: `url(${slide.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: `linear-gradient(135deg, #5b3fd4 0%, ${primaryColor} 50%, #9b7efa 100%)` }
      }
    >
      {/* Overlay semi-transparente para legibilidade sobre imagem */}
      {slide.imageUrl && (
        <div className="absolute inset-0 bg-black/30" />
      )}

      {/* Círculos decorativos (apenas sem imagem) */}
      {!slide.imageUrl && (
        <>
          <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full opacity-10 bg-white" />
          <div className="absolute top-[20px] right-[60px] w-24 h-24 rounded-full opacity-10 bg-white" />
        </>
      )}

      <div className="relative z-10 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-4">
        <div>
          {slide.title && (
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {slide.title}
            </h2>
          )}
          {slide.subtitle && (
            <p className="text-sm text-white/80 mt-1.5">{slide.subtitle}</p>
          )}
        </div>

        {hasCta && (
          <button
            type="button"
            onClick={handleCta}
            className="self-start sm:self-auto shrink-0 h-10 px-6 rounded-xl bg-white text-sm font-bold transition hover:bg-white/90 active:scale-95 truncate max-w-[200px]"
            style={{ color: primaryColor }}
          >
            {slide.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Banner rotativo principal ─────────────────────────────────────────────────

export function HeroBanner({ onCategoryClick, onProductClick }: Props) {
  const { data: config } = useStoreFront();
  const [current, setCurrent] = useState(0);

  const slides = config?.slides ?? [];
  const intervalSecs = config?.bannerIntervalSecs ?? 5;
  const primaryColor = config?.primaryColor ?? "#7c5cf8";

  const total = slides.length;

  const next = useCallback(() => setCurrent((i) => (i + 1) % total), [total]);
  const prev = useCallback(() => setCurrent((i) => (i - 1 + total) % total), [total]);

  // Auto-rotação
  useEffect(() => {
    if (total <= 1 || intervalSecs === 0) return;
    const id = setInterval(next, intervalSecs * 1000);
    return () => clearInterval(id);
  }, [total, intervalSecs, next]);

  // Reset index quando slides mudam
  useEffect(() => { setCurrent(0); }, [total]);

  if (total === 0) {
    return <DefaultSlide onCategoryClick={onCategoryClick} />;
  }

  return (
    <div className="relative mt-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slides[current].id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <SlideContent
            slide={slides[current]}
            primaryColor={primaryColor}
            onCategoryClick={onCategoryClick}
            onProductClick={onProductClick}
          />
        </motion.div>
      </AnimatePresence>

      {/* Controles — só visíveis com múltiplos slides */}
      {total > 1 && (
        <>
          {/* Setas */}
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition"
            aria-label="Próximo slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === current ? 16 : 6,
                  height: 6,
                  backgroundColor: i === current ? "white" : "rgba(255,255,255,0.5)",
                }}
                aria-label={`Ir para slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
