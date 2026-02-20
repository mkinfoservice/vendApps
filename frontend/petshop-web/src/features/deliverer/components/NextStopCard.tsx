import { Phone, MessageCircle, Navigation } from "lucide-react";
import type { DelivererStopDto } from "../types";
import { NavigationButtons } from "./NavigationButtons";

type Props = {
  stop: DelivererStopDto;
  routeId: string;
  onDelivered: () => void;
  onFailed: () => void;
  onSkipped: () => void;
  loading?: boolean;
};

export function NextStopCard({ stop, routeId, onDelivered, onFailed, onSkipped, loading }: Props) {
  const phoneClean = stop.customerPhone.replace(/\D/g, "");

  return (
    <div
      className="rounded-2xl border-2 p-5 space-y-4 shadow-[0_0_30px_rgba(124,92,248,0.15)]"
      style={{ backgroundColor: "var(--surface)", borderColor: "#7c5cf8" }}
    >
      {/* Label + sequence */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[#9b7efa]">
          Próxima Parada
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "rgba(124,92,248,0.15)", color: "#9b7efa" }}
        >
          #{stop.sequence}
        </span>
      </div>

      {/* Customer info */}
      <div>
        <div className="text-lg font-bold" style={{ color: "var(--text)" }}>
          {stop.customerName}
        </div>
        <div className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          {stop.orderNumber}
        </div>
        <div className="text-sm mt-1.5 flex items-start gap-1.5" style={{ color: "var(--text)" }}>
          <span className="shrink-0 mt-0.5">📍</span>
          {stop.address}
        </div>
      </div>

      {/* Contact + Nav buttons */}
      <div className="flex flex-wrap gap-2">
        {phoneClean && (
          <>
            <a
              href={`tel:${phoneClean}`}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <Phone size={15} />
              Ligar
            </a>
            <a
              href={`https://wa.me/55${phoneClean}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#25d366" }}
            >
              <MessageCircle size={15} />
              WhatsApp
            </a>
          </>
        )}
        <a
          href={`https://waze.com/ul?q=${encodeURIComponent(stop.address)}&navigate=yes`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-all hover:opacity-80"
          style={{ backgroundColor: "rgba(124,92,248,0.1)", border: "1px solid rgba(124,92,248,0.25)", color: "#9b7efa" }}
        >
          <Navigation size={15} />
          Navegar
        </a>
      </div>

      {/* Navigation (Google Maps / Waze full buttons) */}
      <NavigationButtons routeId={routeId} />

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onDelivered}
          disabled={loading}
          className="flex-1 h-13 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#10b981" }}
        >
          ✓ Entregue
        </button>
        <button
          onClick={onFailed}
          disabled={loading}
          className="flex-1 h-13 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#ef4444" }}
        >
          ✗ Falhou
        </button>
        <button
          onClick={onSkipped}
          disabled={loading}
          className="h-13 py-3 px-4 rounded-xl font-semibold text-sm transition-all hover:opacity-80 disabled:opacity-50"
          style={{
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Pular
        </button>
      </div>
    </div>
  );
}
