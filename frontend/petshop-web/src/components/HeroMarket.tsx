import { BadgeCheck, Truck, Wallet, Sparkles, ArrowRight, ArrowDown } from "lucide-react";

const WHATSAPP_HELPER_NUMBER = "5521992329239";
const WHATSAPP_HELPER_TEXT = encodeURIComponent(
  "Olá, preciso de ajuda com meu pedido no Catálogo novo!"
);
const WHATSAPP_HELP_URL = `https://wa.me/${WHATSAPP_HELPER_NUMBER}?text=${WHATSAPP_HELPER_TEXT}`;

type Props = {
  title?: string;
  subtitle?: string;
  onPrimaryClick?: () => void;
  helpHref?: string;
};

export function HeroMarket({
  title = "Compre em 1 minuto",
  subtitle = "Entrega rápida • Pix verificado • Cartão na entrega",
  onPrimaryClick,
  helpHref = WHATSAPP_HELP_URL,
}: Props) {
  return (
    <section
      className="mt-4 overflow-hidden rounded-3xl border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      {/* Imagem + overlays */}
      <div className="relative overflow-hidden min-h-[230px] sm:min-h-[260px] lg:min-h-[220px]">
        <img
          src="/hero.png"
          className="absolute inset-0 h-full w-full object-cover lg:object-right opacity-90"
          alt="vendApps"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />

        <div className="relative px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[520px] lg:max-w-[900px]">
            <div className="max-w-[24rem] sm:max-w-[34rem]">
              <div className="flex items-center gap-2 text-xs font-black" style={{ color: "#9b7efa" }}>
                <Sparkles className="h-4 w-4" />
                Catálogo principal • Pedido rápido
              </div>

              <h2 className="mt-2 text-2xl sm:text-3xl lg:text-[34px] font-black leading-tight text-white">
                {title}
              </h2>

              <p className="mt-2 text-[13px] sm:text-base text-white/75 max-w-[22rem] sm:max-w-none">
                {subtitle}
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                {[
                  { icon: Truck, label: "Entrega rápida" },
                  { icon: BadgeCheck, label: "Pix verificado" },
                  { icon: Wallet, label: "Cartão na entrega" },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="w-fit inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] sm:text-xs text-white/85">
                    <Icon className="h-4 w-4" style={{ color: "#9b7efa" }} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onPrimaryClick}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 h-11 px-5 rounded-xl font-extrabold text-sm text-white transition"
                  style={{ backgroundColor: "#7c5cf8" }}
                >
                  Fazer meu pedido
                  <ArrowDown className="h-4 w-4 opacity-80" />
                </button>

                <a
                  href={helpHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 h-11 px-4 rounded-xl border border-white/20 bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition"
                >
                  Preciso de ajuda
                  <ArrowRight className="h-4 w-4 opacity-70" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 sm:px-6 border-t" style={{ borderColor: "var(--border)", backgroundColor: "rgba(0,0,0,0.15)" }}>
        <p className="text-xs text-[var(--text-muted)]">
          Dica: escolha os produtos e finalize pelo carrinho — o pedido vai pronto pro WhatsApp.
        </p>
      </div>
    </section>
  );
}
